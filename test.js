(function() {

	var app = {
		authUri: null,
		handle: null
	};

	var init = function() {

		safeApp.initialise({
			id: 'loziniak.test',
			name: 'Test',
			vendor: 'loziniak'
		}, (newState) => {
			console.log("Network state changed to: ", newState);
		
		}).then((appHandle) => {
			console.log('SAFEApp instance initialised and handle returned: ', appHandle);
			app.handle = appHandle;

		}).then(() => safeApp.authorise(app.handle, {}, {own_container: true}))

		.then((authUri) => {
			console.log('authUri: '+authUri);
			app.authUri = authUri;
			return safeApp.connectAuthorised(app.handle, app.authUri);

		}).then((appHandle) => {
			console.log('appHandle: '+appHandle);
			console.log('app.handle: '+app.handle);
			return safeApp.getContainersNames(app.handle);

		}).then((containers) => {
			console.log('containers: ' + containers);
		});

	};

	var saveButton = document.getElementById('save');
	var readButton = document.getElementById('read');
	var messageDisplay = document.getElementById('msg');

	saveButton.onclick = function() {
		var homeMDHandle = null;

		// insert new entry
		var homePermissionsAndEntriesPromise = safeApp.getHomeContainer(app.handle)
		.then((handle) => {
			homeMDHandle = handle;
			var homeMDEntriesHandle = null;
			
			return Promise.all([
				safeMutableData.getPermissions(handle),

				safeMutableData.getEntries(handle)
				.then((entriesHandle) => 
					// commits directly to network
					safeMutableDataEntries.insert(homeMDEntriesHandle = entriesHandle, 'data1', 'Test1'))
				.then(() => {
					console.log('inserted data.');
					return homeMDEntriesHandle;
				})
			]);
		});

		// prepare new permission
		var allowInsertPromise = safeMutableData.newPermissionSet(app.handle)
		.then((psHandle) => {
			return safeMutableDataPermissionsSet.setAllow(psHandle, 'Insert')
			.then(() => {
				console.log('psHandle: '+psHandle);
				return psHandle;
			});
		});


		// insert new permission
		Promise.all([homePermissionsAndEntriesPromise, allowInsertPromise])
		.then((ret) => {
			var homePermissions = ret[0][0];
			var homeEntries = ret[0][1];
			var allowInsert = ret[1];
			// directly commit to network
			return safeMutableDataPermissions.insertPermissionsSet(homePermissions, null, allowInsert);

		// release MD handle
		}).then(() => {
			console.log('COMMITED.');
			safeMutableData.free(homeMDHandle);
		});

	};

	readButton.onclick = function() {
		safeApp.getHomeContainer(app.handle)

		.then((handle) => md2Obj(handle))

		.then((mdObj) => {
			console.log(mdObj);
			safeMutableData.free(mdObj.handle);
		});
	};

	// converts mutable data to simple object usable for logging
	var md2Obj = function(mdHandle) {
		var obj = { 
			handle: mdHandle,
			name: null,
			tag: null,
			version: null,
			entries: null,
			permissions: null
		};

		return new Promise((resolve, reject) => {
			Promise.all([

				// convert name and tag
				safeMutableData.getNameAndTag(mdHandle)
				.then((nameAndTag) => {
					obj.name = nameAndTag.name.buffer.toString();
					obj.tag = nameAndTag.tag;
				}),

				// convert version
				safeMutableData.getVersion(mdHandle)
				.then((version) => {
					obj.version = version;
				}),

				// convert entries
				safeMutableData.getEntries(mdHandle)
				.then((entriesHandle) => {
					obj.entries = [];
					safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
						obj.entries.push({
							key: k.toString(),
							value: v.buf.toString(),
							valueVersion: v.version
						});
					}).then(() => safeMutableDataEntries.free(entriesHandle));
				}),

				// convert permissions
				safeMutableData.getPermissions(mdHandle)
				.then((permissionsHandle) => {
					obj.permissions = [];
					return safeMutableDataPermissions.forEach(permissionsHandle, (k, v) => {
						obj.permissions.push({
							key: k,
							value: v
						});
					}).then(() => safeMutableDataPermissions.free(permissionsHandle));
				})

			])
			.then(() => resolve(obj));
		});
	};


	init();

})();
