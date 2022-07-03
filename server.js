'use strict';

const
    
    http = require('http'),
    request = require('request'),
    config = require('./config'),

    app_port = process.env.app_port || 80,
    app_host = process.env.app_host || '127.0.0.1';

http.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    
    if (config.twitter && config.twitter.consumerKey && config.twitter.consumerSecret && config.twitter.token && config.twitter.token_secret) {
        let
            oauth = {
                    'consumer_key': config.twitter.consumerKey,
                    'consumer_secret': config.twitter.consumerSecret,
                    'token': config.twitter.token,
                    'token_secret': config.twitter.token_secret,
                },
            url = 'https://api.twitter.com/1.1/application/rate_limit_status.json',
            qs = {
                'resources': 'search,statuses,users',
            };
        
        request.get({url, oauth, qs, 'json':true}, function(err, response, resources) {
            if (err) {
                res.write(`Error: ${err}`);
                throw Error(err);
            }
            if (resources) {
                delete resources.rate_limit_context;
                res.write(`resources ${JSON.stringify(resources,null,'    ')}`);
                res.end();
            }

        });
    } else {
        res.write('No Auth Data.\n\n');
        res.end();
    }

}).listen(app_port);
console.log(`Web server running at http://${app_host}:${app_port}`);

require('./irc.js');
