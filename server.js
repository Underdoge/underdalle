'use strict';

const
    
    http = require('http'),

    app_port = process.env.app_port || 80,
    app_host = process.env.app_host || '127.0.0.1';

http.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
}).listen(app_port);
console.log(`Web server running at http://${app_host}:${app_port}`);

require('./irc.js');
