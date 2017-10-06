
window.safeAPI = {};

(function(API) {
	"use strict"

	var HandleSynchronisedSafeObject = class {

		constructor() {
			this.handlePromise = null; // Promise<?>
		}

		then(onFulfilled, onRejected) {
			return this.handlePromise.then(onFulfilled, onRejected);
		}

	};

	var App = class extends HandleSynchronisedSafeObject {

		authoriseAndConnect(permissions, options) {
			var handleLocal = null; // SAFEAppHandle

			this.handlePromise = this.handlePromise.then((appHandle) => {
				handleLocal = appHandle;
				return safeApp.authorise(appHandle, permissions, options);
			})
			.then((authUri) => safeApp.connectAuthorised(handleLocal, authUri));
		}

		getContainersPermissions() {
			return this.handlePromise.then((appHandle) => safeApp.getContainersPermissions(appHandle)); // Promise<Array<ContainerPerms>>
		}

		getOwnContainer() {
			var homeContainerMD = new MutableData();
			homeContainerMD.handlePromise = this.handlePromise.then((appHandle) => safeApp.getOwnContainer(appHandle));
			return homeContainerMD;
		}

		newPermissionsSet() {
			var newSet = new PermissionsSet();
			newSet.handlePromise = this.handlePromise.then((appHandle) => safeMutableData.newPermissionSet(appHandle));
			return newSet;
		}
	};

	var MutableData = class extends HandleSynchronisedSafeObject {

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

		free() {
			this.handlePromise.then((mdHandle) => {
				safeMutableData.free(mdHandle);
				this.handlePromise = null;
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

		app.handlePromise = safeApp.initialise(appInfo, networkStateCallback, enableLog)
		.then((appHandle) => {
			console.log('SAFEApp instance initialised and handle returned: ', appHandle); // DEBUG
			return appHandle;
		});

		return app; // App
	};


	API.initialiseApp = initialiseApp;

})(safeAPI);
