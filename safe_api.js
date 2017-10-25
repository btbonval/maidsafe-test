
window.safeAPI = {};

(function(API) {
	"use strict"

	var checkHandle = function(myHandle) {
		if ((myHandle === undefined) || (myHandle === null)) {
			throw 'Empty handle passed to ' + this.whoami();
		}
		console.log(this.whoami(), 'initialised and handle returned:', myHandle); // DEBUG
	}


	var promiseChain = {

		lastPromise: null,

		addPromise: function(promise) {
			this.lastPromise = promise;
		},

		addHandlers: function(onFulfilled, onRejected) {
			this.lastPromise = this.lastPromise.then(onFulfilled, onRejected);
		}

	};

	var HandleSynchronisedSafeObject = class {

		free() {
			this.then(_ => {
				if ((this.handle != undefined) && (this.handle != null)) {
					safeApp.free(this.handle);
					console.log(this.whoami(), 'handle freed:', this.handle);
				};
				this.handle = undefined;
			});
			return this;
		}

		all(list) {
			this.then(_ => Promise.all(list));
			return this;
		}

		whoami() {
			return this.constructor.name.toString();
		}

		constructor(handlePromise) {
			super();
			promiseChain.addPromise(handlePromise.then((myHandle) => {
				this.checkHandle(myHandle);
				this.handle = myHandle;
			}));
		}

		then(onFulfilled, onRejected) {
			promiseChain.addHandlers(onFulfilled, onRejected);
			return this;
		}

		catch(onRejected) {
			promiseChain.addHandlers(undefined, onRejected);
			return this;
		}

	};


	var App = class extends HandleSynchronisedSafeObject {

		authoriseAndConnect(permissions, options) {
			return this.then(_ => {
				return safeApp.authorise(this.handle, permissions, options);
			})
			.then((authUri) => safeApp.connectAuthorised(this.handle, authUri))
			.then(_ => safeApp.refreshContainersPermissions(this.handle))
			.then(_ => console.log('Authorised, connected, refreshed permissions.'));
		}

		getContainersPermissions() {
			return this.then(_ => safeApp.getContainersPermissions(this.handle)); // Promise<Array<ContainerPerms>>
		}

		getOwnContainer() {
			return new MutableData(_ => safeApp.getOwnContainer(this.handle));
		}

		newPermissionsSet() {
			return new PermissionsSet(_ => safeMutableData.newPermissionSet(this.handle));
		}

		newMutation() {
			return new Mutation(_ => safeMutableData.newMutation(this.handle));
		}

		quickRandomPublic(data, name, desc) {
			//  looks like this does not get changed?
			const typeTag = 15000;

			let publicMD = new MutableData(_ => safeMutableData.newRandomPublic(this.handle, typeTag));
			publicMD.quickSetup(data, name, desc);
			publicMD.then(_ => console.log('Successfully created and setup random public.'));
			return publicMD;
		}

	};

	var MutableData = class extends HandleSynchronisedSafeObject {

		quickSetup(data, name, desc) {
			return this.then(_ => safeMutableData.quickSetup(this.handle, data, name, desc));
		}

		getPermissions() {
			return new Permissions(_ => safeMutableData.getPermissions(this.handle));
		}

		getEntries() {
			return new Entries(_ => safeMutableData.getEntries(this.handle));
		}

		/* haven't reviewed this -BTB
		applyEntriesMutation(mutation) {
			return this.all([this.handlePromise, mutation.handlePromise])
			.then(([mdHandle, mutHandle]) => safeMutableData.applyEntriesMutation(mdHandle, mutHandle))
			.then(_ => mdHandle);
		}
		*/

		/* haven't reviewed this -BTB
		put(permissions, entries) {
			return this.all([this.handlePromise, permissions.handlePromise, entries.handlePromise])
			.then(([mdHandle, permHandle, entriesHandle]) => safeMutableData.put(mdHandle, permHandle, entriesHandle))
			.then(_ => mdHandle);
		}
		*/

		get(key) {
			return this.then(_ => console.log('Fetching key', key, 'from handle:', this.handle))
			.then(_ => safeMutableData.get(this.handle, key));
		}

		getString(key) {
			return this.get(key)
			.then((val) => {
				return val.buf.toString();
			});
		}

		asNFS() {
			return new NfsEmulation(_ => safeMutableData.emulateAs(this.handle, 'NFS'));
		}

	};

	/* not reviewed -BTB
	var Permissions = class extends HandleSynchronisedSafeObject	 {

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

	var Entries = class extends HandleSynchronisedSafeObject {

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

	var PermissionsSet = class extends HandleSynchronisedSafeObject {

		setAllow(action) {
			return this.then((pSetHandle) => safeMutableDataPermissionsSet.setAllow(pSetHandle, action))
			.then(_ => pSetHandle);
		}

	};

	var Mutation = class extends HandleSynchronisedSafeObject {

		insert(key, value) {
			return this.then((mutHandle) => safeMutableDataMutation.insert(mutHandle, key, value))
			.then(_ => mutHandle);
		}

	};

	var NfsEmulation = class extends HandleSynchronisedSafeObject {

		create(content) {
			return new NfsFile(_ => safeNfs.create(this.handle, content));
		}

		fetch(fileName) {
			return new NfsFile(_ => safeNfs.fetch(this.handle, fileName));
		}

		insert(fileHandle, fileName) {
			return this.then(_ => safeNfs.insert(this.handle, fileHandle, fileName));
		}

		update(fileHandle, fileName) {
			return this.then(_ => safeNfs.update(this.handle, fileHandle, fileName));
		}

		delete(fileName, version) {
			return this.then(_ => safeNfs.delete(this.handle, fileName, version));
		}

		open(fileName, read, append, replace) {
			let mode = 0;
			if ((typeof read !== 'undefined') && read) mode = mode + 4;
			if ((typeof append !== 'undefined') && append) mode = mode + 2;
			if ((typeof replace !== 'undefined') && replace) mode = mode + 1;
			return new NfsFile(_ => safeNfs.open(this.handle, fileName, mode));
			
		}

	};

	var NfsFile = class extends HandleSynchronisedSafeObject {

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

		dataMapName() {
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
