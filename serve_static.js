var _url = require('url');
var _http = require('http');
var _fs = require('fs');

_http.createServer( function (msg, res) {
	msg.setEncoding('utf8');
	var url = _url.parse(msg.url, true);

	var requestBody = '';
	msg.on('data', function (chunk) {
		requestBody += chunk;
	});

	msg.on('end', function() {

		if (url.pathname == '/') {
			url = _url.parse(url.href + 'index.html');
			res.setHeader('Content-Type', 'text/html');
		}

		var filename = '.'+url.pathname;
		_fs.exists(filename, function (exists) {
			var c;
			if (exists) { // TODO: security, hidden files

				try {
					var fileStream = _fs.createReadStream(filename);
					fileStream.setEncoding('utf8');

					if (url.pathname.endsWith('.html')) {
						res.setHeader('Content-Type', 'text/html');

					} else if (url.pathname.endsWith('.js')) {
						res.setHeader('Content-Type', 'application/javascript');
					}
					res.writeHead(200);
					fileStream.pipe(res);

				} catch(e) {
					console.error(e);
					res.writeHead(500);
					res.end('Internal error.');
				}

			} else {
				res.writeHead(404);
				res.end('File not found: ' + url.pathname);
			}
		});

	});

	console.log(new Date().toString() + ' <--' + msg.url); // DEBUG

}).listen(8400, function() {
	console.log(new Date().toString() + ' Server started on port 8400.')
});
