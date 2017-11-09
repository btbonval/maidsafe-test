
window.safeAPI = {};

(function(API) {
	"use strict"

	var SynchronisedCommonCode = class {

		constructor() {
			this.label_prefix = 'GOTO NEXT ';
		}

		/* Translation layer between this and promise chains */

		fork(sidePromise) {
			// DEBUG
			this.debug(100, 'fork()');

			// do not replace the root promiseChain,
			// create a side Promise chain.
			return this.root.promiseChain.then(sidePromise);
		}

		merge(sidePromise) {
			// DEBUG
			this.debug(100, 'merge()');

			// is this our object with root.promiseChain, or is it
			// a raw promiseChain?
			if ((sidePromise.root != undefined) && (sidePromise.root.promiseChain != undefined)) {
				this.debug(100, 'extracted promise');
				sidePromise = sidePromise.root.promiseChain;
			}

			return this.then(_ => Promise.all([this.root.promiseChain, sidePromise]));
		}

		skipToLabelIf(label, register) {
			// If register evaluates to true, jump to the Label.

			label = this.label_prefix + label;
			this.then(_ => {
				if (this[register]) {
					this._debug(75, 'Jumping to', label);
					throw label;
				}
			});
		}

		markLabel(label) {
			label = this.label_prefix + label;
			this.catch((err) => {
				if (err.toString().indexOf(label) >= 0) {
					this._debug(75, 'Jumped to', label);
					// Return back to then() chain
					return;
				}
				// Not the label we're looking for
				throw err;
			});
		}

		/* Helpers */

		log() {
			// If no arguments: output the Promise response.
			// If arguments: treat as debug with level -1.
			// Passes response through to next Promise.

			if (arguments.length === 0) {
				this.root.then((x) => {
					// -1 is more important than critical.
					this._debug(-1, x);
					return x;
				});
			}
			if (arguments.length > 0) {
				var argarray = Array.from(arguments);
				this.debug.apply(this, [-1].concat(argarray));
			}
			return this;
		}

		debug() {
			/*
			  Output to the console depending upon debug level.

			  Level is the first argument:
			    0: critical, 25: warning, 50: verbose, 100: dev

			  Arguments after level go into console.log().
			*/

			this.root.then((x) => {
				var argarray = Array.from(arguments);
				this._debug.apply(this, argarray);
				return x;
			});
			return this;
		}

		lazyDebug(level, f) {
			/*
			  Output to the console depending upon debug level.

			  Level:
			    0: critical, 25: warning, 50: verbose, 100: dev

			  f() is a function that returns a list of arguments for
			  console.log(). This allows lazy evaluation of
			  variables which might not be set until then() is
			  evaluated.
			*/

			this.root.then((x) => {
				var argarray = [level].concat(f());
				this._debug.apply(this, argarray);
				return x;
			});
			return this;
		}

		_debug(level) {
			// Operates assuming it is in a Promise.
			// Should only be used by internal functions.

			if ((this.root.debug_level >= level) && (arguments.length > 1)) {
				// pass arguments ignoring the first one
				var argarray = Array.from(arguments);
				console.log.apply(null, argarray.slice(1));
			}
		}

		setDebug(level) {
			/*
			  Sets the cutoff for output. Any lower level will be
			  outputted, any higher will not.

			  Level:
			    0: critical, 25: warning, 50: verbose, 100: dev
			*/

			return this.then((x) => {
				let root = this.root;
				// cache original value
				if (root.prev_debug === undefined) {
					root.prev_debug = root.debug_level;
					this._debug(25, 'Caching Debug at', root.debug);
				}
				root.debug_level = level;
				this._debug(25, 'Set Debug to', level);
				return x;
			});
		}

		resetDebug() {
			return this.then((x) => {
				let root = this.root;
				// switch back to cached value
				if (root.prev_debug != undefined) {
					root.debug_level = root.prev_debug;
					root.prev_debug = undefined;
					this._debug(25, 'Reset Debug to', root.debug_level);
				}
				return x;
			});
		}

		whoami() {
			return this.constructor.name.toString();
		}

		/* related to SAFE */

		checkHandle(myHandle) {
			if ((myHandle === undefined) || (myHandle === null)) {
				throw 'Empty handle passed to ' + this.whoami();
			}
			// DEBUG
			this._debug(50, this.whoami(), 'initialised and handle returned:', myHandle);
		}

		getHandle() {
			this.then(_ => this.handle);
			return this;
		}

		free() {
			this.then(_ => {
				if ((this.handle != undefined) && (this.handle != null)) {
					safeApp.free(this.handle);
					this._debug(50, this.whoami(), 'handle freed:', this.handle);
				};
				this.handle = undefined;
			});
			return this;
		}

	}

	var HandleSynchronisedSafeRoot = class extends SynchronisedCommonCode {

		constructor(handlePromise) {
			super();
			// Used for consistent `new Class(Promise, this.root)`
			this.root = this;
			// DEBUG
			this.debug_level = 0;
			this.promiseChain = handlePromise.then((myHandle) => {
				this.checkHandle(myHandle);
				this.handle = myHandle;
			});
		}

		then(onFulfilled, onRejected) {
			// DEBUG
			// can't use this.debug because it uses this.root.then
			this.promiseChain = this.promiseChain.then((x) => {
				this._debug(100, 'root.then()');
				return x;
			});

			this.promiseChain = this.promiseChain.then(onFulfilled, onRejected);
			return this;
		}

		catch(onRejected) {
			// DEBUG
			this.debug(100, 'root.catch()');

			this.promiseChain = this.promiseChain.catch(onRejected);
			return this;
		}

	};

	var HandleSynchronisedSafeChild = class extends SynchronisedCommonCode {

		constructor(handlePromise, root) {
			super();
			this.root = root;
			root.then(handlePromise)
			.then((myHandle) => {
				this.checkHandle(myHandle);
				this.handle = myHandle;
			});
		}

		then(onFulfilled, onRejected) {
			// DEBUG
			this.debug(100, 'child.then()');

			this.root.then(onFulfilled, onRejected);
			return this;
		}

		catch(onRejected) {
			// DEBUG
			this.debug(100, 'child.catch()');

			this.root.catch(onRejected);
			return this;
		}

	};

	var App = class extends HandleSynchronisedSafeRoot {

		authoriseAndConnect(permissions, options) {
			return this.then(_ => {
				return safeApp.authorise(this.handle, permissions, options);
			})
			.then((authUri) => safeApp.connectAuthorised(this.handle, authUri))
			.then(_ => safeApp.refreshContainersPermissions(this.handle))
			.debug(50, 'Authorised, connected, refreshed permissions.');
		}

		getContainersPermissions() {
			return this.then(_ => safeApp.getContainersPermissions(this.handle)); // Promise<Array<ContainerPerms>>
		}

		getOwnContainer() {
			return new MutableData(_ => safeApp.getOwnContainer(this.handle), this.root);
		}

		newPermissionsSet() {
			return new PermissionsSet(_ => safeMutableData.newPermissionSet(this.handle), this.root);
		}

		quickRandomPublic(data, name, desc) {
			//  looks like this does not get changed?
			const typeTag = 15000;

			let publicMD = new MutableData(_ => safeMutableData.newRandomPublic(this.handle, typeTag), this.root);
			publicMD.quickSetup(data, name, desc)
			.debug(50, 'Successfully created and setup random public.');
			return publicMD;
		}

		newImmutableData() {
			return new ImmutableWriter(_ => safeImmutableData.create(this.handle), this.root);
		}

		loadImmutableData() {
			// provide xorname through Promise
			return new ImmutableReader((xorname) => safeImmutableData.fetch(this.handle, xorname), this.root);
		}

		newPublicCipher() {
			return new CipherOpt(_ => safeCipherOpt.newPlainText(this.handle), this.root);
		}

		newSymmetricCipher() {
			return new CipherOpt(_ => safeCipherOpt.newSymmetric(this.handle), thos.root);
		}

	};

	var CipherOpt = class extends HandleSynchronisedSafeChild {

		// stores CipherOptHandle

	};

	var ImmutableWriter = class extends HandleSynchronisedSafeChild {

		write(data) {
			this.debug(75, 'Writing:', data);
			return this.then(_ => safeImmutableData.write(this.handle, data));
		}

		closeWriter() {
			// takes in cipherOptHandle from a promise
			return this.then((cipherHandle) => safeImmutableData.closeWriter(this.handle, cipherHandle))
			.then((xorname) => {
				this.xorname = xorname;
				return xorname;
			});
		}

		getXorName() {
			return this.then(_ => {
				if (this.xorname != undefined) return this.xorname;
				throw 'Writer has not been closed.';
			});
		}

		free() {
			this.debug(75, 'ImmutableWriter.free() called, but it cannot be freed.');
			return;
		}

	};

	var ImmutableReader = class extends HandleSynchronisedSafeChild {

		// stores ReaderHandle

		readString() {
			return this.read().then((data) => {
				return new TextDecoder("utf-8").decode(data);
			})
		}

		read() {
			if (this.cacheRead === undefined) {
				return this.then(_ => safeImmutableData.read(this.handle))
				.then((data) => {
					this.cacheRead = data;
					return data;
				});
			} else {
				return this.then(_ => this.cacheRead);
			}
		}

		size() {
			return this.then(_ => safeImmutableData.size(this.handle));
		}

	};

	var MutableData = class extends HandleSynchronisedSafeChild {

		quickSetup(data, name, desc) {
			return this.then(_ => safeMutableData.quickSetup(this.handle, data, name, desc));
		}

		getPermissions() {
			return new Permissions(_ => safeMutableData.getPermissions(this.handle), this.root);
		}

		getEntries() {
			return new Entries(_ => safeMutableData.getEntries(this.handle), this.root);
		}

		newMutation() {
			return new Mutation(_ => safeMutableData.newMutation(this.handle), this.root);
		}

		beginInserts() {
			if (this.inserts != undefined) {
				this.debug(25, 'beginInserts() called after it was previously called.');
				return;
			}
			this.debug(75, 'beginInserts()');

			this.inserts = this.newMutation();
		}

		insert(key, value) {
			// if value is none, value is passed in from Promise
			if (value === undefined) {
				this.then((retval) => {
					this._debug(75, 'Using', retval, 'as insert value');
					value = retval;
				});
			}

			// setup and commit a mutation if one is not ready
			let single_pass = false;
			if (this.inserts === undefined) {
				single_pass = true;
				this.beginInserts();
			}

			let retval = this.inserts.getHandle()
                        .then((insertHandle) => {
				this._debug(75, 'Inserting', key, ':', value, 'into', insertHandle);
				safeMutableDataMutation.insert(insertHandle, key, value);
			});

			if (single_pass) {
				this.commitInserts();
			}
			return retval;
		}

		commitInserts() {
			if (this.inserts === undefined) {
				this.debug(0, 'commitInserts() called without beginInserts(), ignoring it.');
				return;
			};
			this.debug(75, 'commitInserts()');

			let retval = this.inserts.getHandle()
			.then((insertHandle) => safeMutableData.applyEntriesMutation(this.handle, insertHandle));

			// clean up
			this.inserts = undefined;

			return retval;
		}

		get(key) {
			return this.lazyDebug(50, _ => ['Fetching key', key, 'from handle:', this.handle])
			.then(_ => safeMutableData.get(this.handle, key));
		}

		getString(key) {
			return this.get(key)
			.then((val) => {
				return val.buf.toString();
			});
		}

		getVersion() {
			return this.then(_ => safeMutableData.getVersion(this.handle));
		}

		getNameAndTag() {
			return this.then(_ => safeMutableData.getNameAndTag(this.handle));
		}

		getNetworkName() {
			return this.getNameAndTag().then((r) => {
				this._debug(75, 'nfs name and tag:', r);
				// append 2 bytes of tag to 32 bytes of name
				let a = Array.from(r.name.buffer);
				a.push((r.tag & 65535) >> 8);
				a.push(r.tag & 255);
				let b = Uint8Array.from(a);
				this._debug(75, 'network name result:', b);
				return b;
			});
		}

		getNetworkObj(key) {
			this.get(key);
			return this.then((tag_name_container) => {
				let tag_name = tag_name_container.buf;

				// convert last two bytes into tag
				// keep first 32 bytes for name
				let a = {
					'type_tag': (tag_name[32] << 8) + tag_name[33],
					'name': tag_name.slice(0,32)
				};
				this._debug(75, 'Network Object:', a);
				return a;
			});
		}

		saveToMdAs(mdObj, key) {
			this.getNetworkName();
			mdObj.insert(key);
			return this;
		}

		loadMdFrom(key) {
			this.getNetworkObj(key);
			return new MutableData((netObj) => safeMutableData.newPublic(this.handle, netObj.name, netObj.type_tag), this.root);
		}

		asNFS() {
			return new NfsEmulation(_ => safeMutableData.emulateAs(this.handle, 'NFS'), this.root);
		}

	};

	/* not reviewed -BTB
	var Permissions = class extends HandleSynchronisedSafeChild {

		insertPermissionsSet(signKey, permissionsSet) {

			return this.all([this.handlePromise, signKey ? signKey.handlePromise : null, permissionsSet.handlePromise])
			.then(([permHandle, skHandle, pSetHandle]) => {
					console.log('skHandle: ',skHandle);
					return safeMutableDataPermissions.insertPermissionsSet(permHandle, skHandle, pSetHandle);
			})
			.then(_ => permHandle);
		}

	};
	*/

	var Entries = class extends HandleSynchronisedSafeChild {

		len() {
			return this.then(_ => safeMutableDataEntries.len(this.handle));
		}

		insert(key, value) {
			return this.then(_ => safeMutableDataEntries.insert(this.handle, key, value));
		}

		forEach(f) {
			return this.then(_ => safeMutableDataEntries.forEach(this.handle, f));
		}

	};

	var PermissionsSet = class extends HandleSynchronisedSafeChild {

		setAllow(action) {
			return this.then((pSetHandle) => safeMutableDataPermissionsSet.setAllow(pSetHandle, action))
			.then(_ => pSetHandle);
		}

	};

	var Mutation = class extends HandleSynchronisedSafeChild {

		insert(key, value) {
			return this.then((mutHandle) => safeMutableDataMutation.insert(mutHandle, key, value))
			.then(_ => mutHandle);
		}

	};

	var NfsEmulation = class extends HandleSynchronisedSafeChild {

		create(content) {
			return new NfsFile(_ => safeNfs.create(this.handle, content), this.root);
		}

		fetch(fileName) {
			return new NfsFile(_ => safeNfs.fetch(this.handle, fileName), this.root);
		}

		insert(fileName) {
			// expects fileHandle to be passed via Promise
			return this.then((fileHandle) => {
				this._debug(50, 'adding file named', fileName, 'with handle', fileHandle, 'to NFSEmulation', this.handle)
				return safeNfs.insert(this.handle, fileHandle, fileName);
			});
		}

		update(fileHandle, fileName) {
			return this.then(_ => safeNfs.update(this.handle, fileHandle, fileName));
		}

		delete(fileName, version) {
			return this.then(_ => safeNfs.delete(this.handle, fileName, version));
		}

		open(fileName, read, append, replace) {
			let mode = 0;
			if ((read != undefined) && (read != null) && (read != false)) mode = mode + 4;
			if ((append != undefined) && (append != null) && (append != false)) mode = mode + 2;
			if ((replace != undefined) && (replace != null) && (replace != false)) mode = mode + 1;
			return new NfsFile(_ => safeNfs.open(this.handle, fileName, mode), this.root);
			
		}

	};

	var NfsFile = class extends HandleSynchronisedSafeChild {

		size() {
			return this.then(_ => safeNfsFile.size(this.handle));
		}

		read() {
			return this.then(_ => safeNfsFile.read(this.handle));
		}

		close() {
			return this.then(_ => safeNfsFile.close(this.handle));
		}

		metadata() {
			return this.then(_ => safeNfsFile.metadata(this.handle));
		}

		xor() {
			return this.metadata().then(obj => obj.dataMapName);
		}

		created() {
			return this.metadata().then(obj => obj.created);
		}

		modified() {
			return this.metadata().then(obj => obj.modified);
		}

		version() {
			return this.metadata().then(obj => obj.version);
		}

	};

	var initialiseApp = function(appInfo, networkStateCallback, enableLog) {

		return new App(safeApp.initialise(appInfo, networkStateCallback, enableLog));

	};


	API.initialiseApp = initialiseApp;

})(safeAPI);
