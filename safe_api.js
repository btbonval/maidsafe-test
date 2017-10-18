
window.safeAPI = {};

(function(API) {
	"use strict"

	var HandleSynchronisedSafeObject = class {

		constructor() {
			this.handlePromise = null; // Promise<?>
		}

		then(onFulfilled, onRejected) {
			this.handlePromise = this.handlePromise.then(onFulfilled, onRejected);
			return this;
		}

		catch(onRejected) {
			this.handlePromise = this.handlePromise.catch(onRejected);
			return this;
		}

	};

	var HandleSynchronisedSafeChild = class {

		constructor(parent) {
			this.parent = parent;
		}

		then(onFulfilled, onRejected) {
			this.parent.then(onFulfilled, onRejected);
			return this;
		}

		catch(onRejected) {
			this.parent.catch(onRejected);
			return this;
		}

	};

	var App = class extends HandleSynchronisedSafeObject {

		authoriseAndConnect(permissions, options) {
			this.handleLocal = null; // SAFEAppHandle

			return this.then((appHandle) => {
				this.handleLocal = appHandle;
				return safeApp.authorise(appHandle, permissions, options);
			})
			.then((authUri) => safeApp.connectAuthorised(this.handleLocal, authUri))
			.then(_ => safeApp.refreshContainersPermissions(this.handleLocal));
		}

		getContainersPermissions() {
			return this.handlePromise.then((appHandle) => safeApp.getContainersPermissions(appHandle)); // Promise<Array<ContainerPerms>>
		}

		getOwnContainer() {
			var homeContainerMD = new MutableData(this);
			homeContainerMD.handlePromise = this.handlePromise.then((appHandle) => safeApp.getOwnContainer(appHandle));
			return homeContainerMD;
		}

		newPermissionsSet() {
			var newSet = new PermissionsSet();
			newSet.handlePromise = this.handlePromise.then((appHandle) => safeMutableData.newPermissionSet(appHandle));
			return newSet;
		}

		quickRandomPublic(data) {
			//  looks like this does not get changed?
			const typeTag = 15000;

			var publicMD = new MutableData(this);
			console.log('new publicMD: ', publicMD);
			this.then(_ => safeMutableData.newRandomPublic(this.handleLocal, typeTag))
			.then((mdata) => {
				console.log('Random MD handle: ', mdata);
				publicMD.mdHandle = mdata;
				return safeMutableData.quickSetup(mdata, data);
			})
			.then(_ => {
				console.log('MD handle was setup: ', publicMD.mdHandle);
				return publicMD.mdHandle;
			});
			return publicMD;
		}

		free() {
			this.then(_ => {
				if ((this.handleLocal != undefined) && (this.handleLocal != null)) {
					safeApp.free(this.handleLocal);
					console.log('App handle freed: ', this.handleLocal);
				}
				this.handleLocal = undefined;
				this.handlePromise = null;
				console.log('App.free() completed');
			});
		}
	};

	var MutableData = class extends HandleSynchronisedSafeChild {

		getPermissions() {
			var permissions = new Permissions();
			permissions.handlePromise = this.handlePromise.then((mdHandle) => safeMutableData.getPermissions(mdHandle));
			return permissions;
		}

		getEntries() {
			var entries = new Entries();
			entries.handlePromise = this.handlePromise.then((mdHandle) => safeMutableData.getEntries(mdHandle));
			return entries;
		}

		put(permissions, entries) {
			this.handlePromise = Promise.all([this.handlePromise, permissions.handlePromise, entries.handlePromise],
				([mdHandle, permHandle, entriesHandle]) => {
					safeMutableData.put(mdHandle, permHandle, entriesHandle)
					.then(() => mdHandle);
				});
		}

		getString(key) {
			return this.then(_ => {
				console.log('Fetching key from handle: ', key, this.mdHandle);
				return safeMutableData.get(this.mdHandle, key);
			})
			.then((val) => {
				return val.buf.toString();
			});
		}

		free() {
			this.then((mdHandle) => {
				// Nothing to do if no handles are provided
				if ((mdHandle === undefined) && (this.mdHandle === undefined)) {
					console.log('No MD to free.');
				};
				// only this.mdHandle is defined, clear it.
				if ((mdHandle === undefined) && (this.mdHandle != undefined)) {
					safeMutableData.free(this.mdHandle);
					console.log('Freed MD: ', this.mdHandle);
					this.mdHandle = undefined;
				};
				// only mdHandle is defined, clear it.
				if ((mdHandle != undefined) && (this.mdHandle === undefined)) {
					safeMutableData.free(mdHandle);
					console.log('Freed MD: ', mdHandle);
				};
				// both are defined and equal, clear both.
				if ((mdHandle != undefined) && (this.mdHandle != undefined) && (mdHandle == this.mdHandle)) {
					safeMutableData.free(mdHandle);
					this.mdHandle = undefined;
					console.log('Freed MD: ', mdHandle);
				};
				// if both are defined and different, unclear how to proceed.
				if ((mdHandle != undefined) && (this.mdHandle != undefined) && (mdHandle != this.mdHandle)) throw 'Cannot decide which handle to free!';
			});
		}

	};

	var Permissions = class extends HandleSynchronisedSafeObject {

		insertPermissionsSet(signKey, permissionsSet) {

			this.handlePromise = this.handlePromise.then((permHandle) =>  // wait for parameters
				Promise.all([signKey ? signKey.handlePromise : undefined, permissionsSet.handlePromise], ([skHandle, pSetHandle]) => {

					console.log('skHandle:'+skHandle);
					safeMutableDataPermissions.insertPermissionsSet(permHandle, skHandle, pSetHandle)
					.then(() => permHandle);
				})
			);
		}

	};

	var Entries = class extends HandleSynchronisedSafeObject {

		insert(keyName, value) {
			this.handlePromise = this.handlePromise.then((entriesHandle) => {
				safeMutableDataEntries.insert(entriesHandle, keyName, value).then(() => {
					return entriesHandle;
				})
			});
		}

	};

	var PermissionsSet = class extends HandleSynchronisedSafeObject {

		setAllow(action) {
			this.handlePromise = this.handlePromise.then((pSetHandle) => safeMutableDataPermissionsSet.setAllow(pSetHandle, action)
				.then(() => pSetHandle));
		}

	};

	var SignKey = class extends HandleSynchronisedSafeObject {

	};


	var initialiseApp = function(appInfo, networkStateCallback, enableLog) {

		var app = new App();

		app.handlePromise = safeApp.initialise(appInfo, networkStateCallback, enableLog);
		app.then((appHandle) => {
			console.log('SAFEApp instance initialised and handle returned: ', appHandle); // DEBUG
			return appHandle;
		});

		return app; // App
	};


	API.initialiseApp = initialiseApp;

})(safeAPI);
