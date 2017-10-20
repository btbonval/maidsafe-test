
window.safeAPI = {};

(function(API) {
	"use strict"

	var HandleSynchronisedSafeObject = class {

		constructor(handle, promise) {
			this.handle = handle;
			this.handlePromise = promise;
		}

		then(onFulfilled, onRejected) {
			this.handlePromise = this.handlePromise.then(onFulfilled, onRejected);
			return this;
		}

		catch(onRejected) {
			this.handlePromise = this.handlePromise.catch(onRejected);
			return this;
		}

		all(list) {
			return this.then(_ => Promise.all(list));
		}

		free() {
			this.then(_ => {
				if ((this.handle != undefined) && (this.handle != null)) {
					safeApp.free(this.handle);
					console.log('App handle freed: ', this.handle);
				};
				this.handle = undefined;
				this.handlePromise = null;
				console.log('App.free() completed');
			});
		}

	};

	var HandleSynchronisedSafeChild = class {

		constructor(handle, parent) {
			this.handle = handle;
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

		all(list) {
			return this.then(_ => Promise.all(list));
		}

		free() {
			this.then(_ => {
				if ((this.handle != undefined) && (this.handle != null)) {
					safeApp.free(this.handle);
					console.log('handle freed: ', this.handle);
				};
				this.handle = undefined;
				console.log('free() completed');
			});
		}

	};

	var App = class extends HandleSynchronisedSafeObject {

		authoriseAndConnect(permissions, options) {
			return this.then(_ => {
				return safeApp.authorise(this.handle, permissions, options);
			})
			.then((authUri) => safeApp.connectAuthorised(this.handle, authUri))
			.then(_ => safeApp.refreshContainersPermissions(this.handle));
		}

		getContainersPermissions() {
			return this.then(_ => safeApp.getContainersPermissions(this.handle)); // Promise<Array<ContainerPerms>>
		}

		getOwnContainer() {
			var homeContainerMD;
			this.then(_ => safeApp.getOwnContainer(this.handle))
			.then((mdHandle) => {
				homeContainerMD = new MutableData(mdHandle, this);
			});
			return homeContainerMD;
		}

		newPermissionsSet() {
			var newSet;
			this.then(_ => safeMutableData.newPermissionSet(this.handle))
			.then((psHandle) => {
				newSet = new PermissionsSet(psHandle, this);
			});
			return newSet;
		}

		newMutation() {
			var newMut;
			this.then(_ => safeMutableData.newMutation(this.handle))
			.then((mHandle) => {
				newMut = new Mutation(mHandle, this);
			});
			return newMut;
		}

		quickRandomPublic(data, name, desc) {
			//  looks like this does not get changed?
			const typeTag = 15000;

			var publicMD;
			console.log('new publicMD: ', publicMD);
			this.then(_ => safeMutableData.newRandomPublic(this.handleLocal, typeTag))
			.then((mdata) => {
				publicMD = new MutableData(mdata, this);
				console.log('Random MD handle: ', mdata);
				return safeMutableData.quickSetup(mdata, data, name, desc);
			})
			.then(_ => console.log('MD handle was setup: ', publicMD.mdHandle));
			return publicMD;
		}

	};

	var MutableData = class extends HandleSynchronisedSafeChild {

		getPermissions() {
			var permissions;
			this.then(_ => safeMutableData.getPermissions(this.handle))
			.then((pHandle) => {
 				permissions = new Permissions(pHandle, this);
			});
			return permissions;
		}

		getEntries() {
			var entries;
			this.then(_ => safeMutableData.getEntries(this.mdHandle))
			.then((enHandle) => {
 				entries = new Entries(enHandle, this);
			});
			console.log('New Entries: ', entries);
			return entries;
		}

		applyEntriesMutation(mutation) {
			return this.all([this.handlePromise, mutation.handlePromise])
			.then(([mdHandle, mutHandle]) => safeMutableData.applyEntriesMutation(mdHandle, mutHandle))
			.then(_ => mdHandle);
		}

		put(permissions, entries) {
			return this.all([this.handlePromise, permissions.handlePromise, entries.handlePromise])
			.then(([mdHandle, permHandle, entriesHandle]) => safeMutableData.put(mdHandle, permHandle, entriesHandle))
			.then(_ => mdHandle);
		}

		get(key) {
			return this.then(_ => {
				console.log('Fetching key from handle: ', key, this.mdHandle);
				return safeMutableData.get(this.mdHandle, key);
			});
		}

		getString(key) {
			return this.get(key)
			.then((val) => {
				return val.buf.toString();
			});
		}

	};

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

	var SignKey = class extends HandleSynchronisedSafeChild {

	};


	var initialiseApp = function(appInfo, networkStateCallback, enableLog) {

		var app;

		let promise = safeApp.initialise(appInfo, networkStateCallback, enableLog);
		promise.then((appHandle) => {
			app = new App(promise, appHandle);
			console.log('SAFEApp instance initialised and handle returned: ', appHandle); // DEBUG
			return app;
		});

		return app; // App
	};


	API.initialiseApp = initialiseApp;

})(safeAPI);
