
(function() {
	"use strict"

	var app;

	var init = function() {

		app = safeAPI.initialiseApp({
			id: 'loziniak.test',
			name: 'Test',
			vendor: 'loziniak'
		}, (newState) => {
			console.log("Network state changed to: ", newState);
		
		});

		app.authoriseAndConnect({}, {own_container: true});

		app.getContainersPermissions().then((containers) => console.log(containers));

	};

	var saveButton = document.getElementById('save');
	var readButton = document.getElementById('read');
	var messageDisplay = document.getElementById('msg');

	saveButton.onclick = function() {
		var homeContainer = app.getOwnContainer();

		var homeEntries = homeContainer.getEntries();
		homeEntries.insert('data1', 'Test1');
		homeEntries.then(() => console.log('inserted data.'));

		var allowInsert = app.newPermissionsSet();
		allowInsert.setAllow('Insert');
		allowInsert.then((psHandle) => console.log('psHandle: '+psHandle));

		var homePermissions = homeContainer.getPermissions();
		homePermissions.insertPermissionsSet(null, allowInsert);
		homePermissions.then(() => console.log('permissions set.'));

		homeContainer.put(homePermissions, homeEntries);
		homeContainer.then(() => console.log('COMMITED.'));
	};


	readButton.onclick = function() {
		app.getOwnContainer()
		.then((mdHandle) => md2Obj(mdHandle))
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
