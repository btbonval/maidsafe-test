
window.safeAPI = {};

(function(API) {
	"use strict"

	var App = class {

		constructor() {
			this.handle = null; // Promise<SAFEAppHandle>
		}

		authoriseAndConnect(permissions, options) {
			var handleLocal = null; // SAFEAppHandle

			this.handle = this.handle.then((appHandle) => {
				handleLocal = appHandle;
				return safeApp.authorise(appHandle, permissions, options);
			})
			.then((authUri) => safeApp.connectAuthorised(handleLocal, authUri));
		}

		getContainersNames() {
			return this.handle.then((appHandle) => safeApp.getContainersNames(appHandle)); // Promise<Array<String>>
		}

		getHomeContainer() {
			var homeContainerMD = new MutableData();
			homeContainerMD.handle = this.handle.then((appHandle) => safeApp.getHomeContainer(appHandle));
			return homeContainerMD;
		}

		newPermissionsSet() {
			var newSet = new PermissionsSet();
			newSet.handle = this.handle.then((appHandle) => safeMutableData.newPermissionSet(appHandle));
			return newSet;
		}
	};

	var MutableData = class {

		constructor() {
			this.handle = null; // Promise<MutableDataHandle>
		}

		getPermissions() {
			var permissions = new Permissions();
			permissions.handle = this.handle.then((mdHandle) => safeMutableData.getPermissions(mdHandle));
			return permissions;
		}

		getEntries() {
			var entries = new Entries();
			entries.handle = this.handle.then((mdHandle) => safeMutableData.getEntries(mdHandle));
			return entries;
		}

		free() {
			this.handle.then((mdHandle) => {
				safeMutableData.free(mdHandle);
				this.handle = null;
			});
		}

	};

	var Permissions = class {

		constructor() {
			this.handle = null; // Promise<PermissionsHandle>
		}

		insertPermissionsSet(signKey, permissionsSet) {

			this.handle = this.handle.then((permHandle) =>  // wait for parameters
				Promise.all([signKey ? signKey.handle : undefined, permissionsSet.handle], ([skHandle, pSetHandle]) => {

					safeMutableDataPermissions.insertPermissionsSet(permHandle, skHandle, pSetHandle)
					.then(() => permHandle);
				})
			);
		}

	};

	var Entries = class {

		constructor() {
			this.handle = null; // Promise<EntriesHandle>
		}

		insert(keyName, value) {
			this.handle = this.handle.then((entriesHandle) => {
				safeMutableDataEntries.insert(entriesHandle, keyName, value).then(() => {
					return entriesHandle;
				})
			});
		}

	};

	var PermissionsSet = class {

		constructor() {
			this.handle = null; // Promise<PermissionsSetHandle>
		}

		setAllow(action) {
			this.handle = this.handle.then((pSetHandle) => safeMutableDataPermissionsSet.setAllow(pSetHandle, action)
				.then(() => pSetHandle));
		}

	};

	var SignKey = class {

		constructor() {
			this.handle = null; // Promise<SignKeyHandle>
		}

	};


	var initialiseApp = function(appInfo, networkStateCallback, enableLog) {

		var app = new App();

		app.handle = safeApp.initialise(appInfo, networkStateCallback, enableLog)
		.then((appHandle) => {
			console.log('SAFEApp instance initialised and handle returned: ', appHandle); // DEBUG
			return appHandle;
		});

		return app; // App
	};


	API.initialiseApp = initialiseApp;

})(safeAPI);
