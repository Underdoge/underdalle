'use strict';

const
    fs = require('fs'),
    http = require('http'),

    app_port = process.env.app_port || 80,
    app_host = process.env.app_host || '127.0.0.1';

http.createServer(function(req, res) {
    fs.readFile("dalle.jpg", function (err,data) {
        if (err) {
          res.writeHead(404);
          res.end(JSON.stringify(err));
          return;
        }
        res.writeHead(200);
        res.end(data);
      });
}).listen(app_port);
console.log(`Web server running at http://${app_host}:${app_port}`);

require('./irc.js');
