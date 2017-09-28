
window.safeAPI = {};

(function(API) {
	"use strict"

	// var SafeAPIPromise = class {
	// 	constructor(promise) {
	// 		this.then = function (onSucc, onErr) {
	// 			return promise.then(onSucc, onErr);
	// 		};
	// 	}
	// };

	// var AppPromise = class extends SafeAPIPromise {
	// };

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

			return this.handle; // Promise<SAFEAppHandle>
		}

		getContainersNames() {
			return this.handle.then((appHandle) => safeApp.getContainersNames(appHandle)); // Promise<Array<String>>
		}
	};

	var initialiseApp = function(appInfo, networkStateCallback, enableLog) {

		var app = new App();

		app.handle = safeApp.initialise(appInfo, networkStateCallback, enableLog)
		.then((appHandle) => {
			console.log('SAFEApp instance initialised and handle returned: ', appHandle); // DEBUG
		});

		return app; // App
	};


	API.initialiseApp = initialiseApp;

})(safeAPI);
