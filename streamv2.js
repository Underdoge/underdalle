'use strict';

const
    writableStream = require('stream'),
    irc = require('./irc'),
    colors = require('irc-colors'),
    config = require('./config'),
    nedb = require('nedb'),
	dateOptions = {
        'timeZone':'America/Mexico_City',
        'weekday': 'long', 'year': 'numeric', 'month': 'short',
        'day': 'numeric', 'hour': '2-digit', 'minute': '2-digit',
    },
    htmlMap ={
        '&amp;': '&', '&lt;':'<', '&gt;':'>',
    },
    htmlKeys = ['&amp;', '&lt;', '&gt;'],
    rulesURL = config.twitter.rulesURL,
    streamURL = config.twitter.streamURL,
    token = config.twitter.bearer_token;

var
    needle = require('needle'),
    STATUS_CODE = '',
    wait = 60000,
    channels = [],
    stream = null,
    pipe = null,
    message='',
    screen_names='';

class streamReader extends writableStream.Writable {
    constructor(options) {
        super(options);
        this.result = '';
    }
    _write (data,encoding,callback) {
        try {
            if (data != "\r\n") {
                let tweet = JSON.parse(data);
                if (tweet.data) {
                    let
                        id = tweet.data.id,
                        url = 'https://api.twitter.com/1.1/statuses/show.json',
                        query = {
                            id,
                            'tweet_mode': 'extended',
                        };
                    needle.request('get', url, query, { headers: { "authorization": `Bearer ${token}`}}, function(err, r, json) {
                        if (err) {
                            bot.say(to,`Error: ${err}`);
                            throw Error(err);
                        }
                        if (!json.errors && json) {
                            channels.forEach(function (chan) {
                                screen_names = chan[1].toString().split(',');
                                screen_names.forEach(function (screen_name) {
                                    //need to make call to make call to get tweet and insert in json variable
                                    if (screen_name == json.user.screen_name) {
                                        if (json.retweeted_status) {
                                            if (json.retweeted_status.truncated){
                                                json.text = `RT @${json.retweeted_status.user.screen_name}: ${json.retweeted_status.extended_tweet.full_text}`;
                                            } else {
                                                json.text = `RT @${json.retweeted_status.user.screen_name}: ${json.retweeted_status.text}`;
                                            }
                                            json.favorite_count = json.retweeted_status.favorite_count;
                                            json.retweet_count = json.retweeted_status.retweet_count;
                                            
                                        }
                                        if (json.truncated){
                                            json.text = json.extended_tweet.full_text.replace(/\n/g,' ');    
                                        } else {
                                            json.text = json.full_text.replace(/\n/g,' ');
                                        }
                                        htmlKeys.forEach( curr => {
                                            json.text = json.text.replace(new RegExp(curr,'g'),unescape(curr));
                                        });
                                        if (json.quoted_status) {
                                            if (json.quoted_status.truncated){
                                                json.quoted_status.text = json.quoted_status.extended_tweet.full_text.replace(/\n/g,' ');    
                                            } else {
                                                json.quoted_status.text = json.quoted_status.text.replace(/\n/g,' ');
                                            }
                                            json.text = json.text.replace(/https:\/\/t\.co\/.+$/i,'').trimRight();
                                            htmlKeys.forEach( curr => {
                                                json.quoted_status.text = json.quoted_status.text.replace(new RegExp(curr,'g'),unescape(curr));
                                            });
                                            message = `${colors.teal(json.text)} · by ${json.user.name} (@${json.user.screen_name}) \
on ${new Date(json.created_at).toLocaleDateString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.favorite_count.toLocaleString('en-us')}`)} \
Quoting @${json.quoted_status.user.screen_name}: ${colors.teal(json.quoted_status.text)}`;
                                    // check if message too long for IRC
                                            if (message.length > 350) {
                                                irc.sayToChannel(chan[0],`${colors.teal(json.text)}`);
                                                irc.sayToChannel(chan[0],`by ${json.user.name} (@${json.user.screen_name}) \
on ${new Date(json.created_at).toLocaleDateString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.favorite_count.toLocaleString('en-us')}`)}`);
                                                irc.sayToChannel(chan[0],`Quoting @${json.quoted_status.user.screen_name}: ${colors.teal(json.quoted_status.text)}`);
                                                return;
                                            } else {
                                                irc.sayToChannel(chan[0],message);
                                            }
                                        } else {
                                            message = `${colors.teal(json.text)} · by ${json.user.name} (@${json.user.screen_name}) \
on ${new Date(json.created_at).toLocaleTimeString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.favorite_count.toLocaleString('en-us')}`)}`;
                                            if (message.length > 350) {
                                                irc.sayToChannel(chan[0],`${colors.teal(json.text)}`);
                                                irc.sayToChannel(chan[0],`by ${json.user.name} (@${json.user.screen_name}) \
on ${new Date(json.created_at).toLocaleTimeString('en-us', dateOptions)} ·\
${colors.green(` ♻ ${json.retweet_count.toLocaleString('en-us')}`)}\
${colors.red(` ❤ ${json.favorite_count.toLocaleString('en-us')}`)}`);
                                        return;
                                            } else {
                                                irc.sayToChannel(chan[0],message);
                                            }
                                        }
                                    }                                        
                                });
                            });
                        }
                    });
                }
                // limit notices
                if (tweet.limit) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Limit notice: ${JSON.stringify(tweet.limit,null,'    ')}`);
                }
                // Withheld content notices
                if (tweet.status_withheld) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Withheld content notice: ${JSON.stringify(tweet.status_withheld,null,'    ')}`);
                }
                if (tweet.user_withheld) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] User withheld notice: ${JSON.stringify(tweet.user_withheld,null,'    ')}`);
                }
                // Disconnect message
                if (tweet.disconnect) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Disconnect notice: ${JSON.stringify(tweet.disconnect,null,'    ')}`);
                }
                // Stall warning
                if (tweet.warning) {
                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stall warning: ${JSON.stringify(tweet.warning,null,'    ')}`);
                }
            }
        } catch (e) {
            console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error: ${e}`);
        }
        callback();
    }
}

function unescape(char) {
    return htmlMap[char];
}

function getWait(){
    return wait;
}

function setWait(val){
    wait = val;
}

function getStream() {
    return stream;
}

function setStream(val) {
    stream = val;
}

function getPipe() {
    return pipe;
}

function setPipe(val) {
    return pipe = val;
}

function getStatusCode() {
    return STATUS_CODE;
}

function setStatusCode(code) {
    STATUS_CODE = code;
}


exports.endStream = function() {
    if (getStream()){
        getStream().end();
        getStream().abort();
        getPipe().destroy();
    }
};

exports.startStream = function(db) {
    //Get following rules
    needle.get(rulesURL, { headers: { "authorization": `Bearer ${token}`}}, function (error, response){
        if (response.statusCode !== 200)
            irc.sayToChannel('#testing',`Get All Rules Error Code:${response.statusCode} \n Error:${response.body}`);
        if (!Array.isArray(response.body.data)) {
            return null;
        }
        let ids = response.body.data.map(rule => rule.id);
        let data = {
            "delete": {
                "ids": ids
            }
        }
        //Delete following rules
        needle.post(rulesURL, data, {headers: {"content-type": "application/json","authorization": `Bearer ${token}`}},function (error,response){
            if (response.statusCode !== 200) {
                irc.sayToChannel('#testing',`Delete All Rules Error Code:${response.statusCode} \n Error:${response.body}`);
            } else {
                db.find({}, function (err, following) {
                    let following_nicks = [],
                        following_rule = null;
                    channels = [];
                    following.forEach(function (channel,index) {
                        channels.push([channel.channel]);
                        channels[index].push(channel.handles);
                        channel.handles.forEach(function (nick) {
                            if (following_nicks.indexOf(nick) === -1)
                                following_nicks.push(nick);
                        });
                    });
                    if(following_nicks.length > 0){
                        following_nicks.forEach(function(nick,i) {
                            if (i === 0){
                                following_rule = `from:${nick}`;
                            } else {
                                following_rule = following_rule + ` OR from:${nick}`;
                            }
                        });
                        const rules = [{
                            'value': following_rule,
                            'tag': 'following nicks'
                        }];
                        const data = {
                            "add": rules
                        };
                        //Set following rules
                        needle.post(rulesURL, data, { headers: {"content-type": "application/json","authorization": `Bearer ${token}`}}, function (error,response){
                            if (response.statusCode !== 201) {
                                irc.sayToChannel('#testing',`Set Rules Error Code:${response.statusCode} \n Error:${response.body}`);
                            } else {
                                console.log(`Following rule set: ${following_rule}`);
                                if (getStream()){
                                    getStream().abort();
                                    getPipe().destroy();
                                    getStream().removeAllListeners();
                                    getStream().destroy();
                                }
                                let
                                    p = new streamReader(),          
                                    stream = needle.get(streamURL, {
                                        headers: {
                                            "User-Agent": "v2FilterStreamJS",
                                            "Authorization": `Bearer ${token}`
                                        },
                                        timeout: 20000
                                    });
                                stream.on('error', function (error) {
                                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error Code:${error.code} \n Error:${error}`);
                                    irc.sayToChannel('#testing',`Error in connection: "${error.code}", restarting.`);
                                    exports.startStream(new nedb(config.nedb));
                                })
                                .on('timeout', function() {
                                    console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Connection Timeout.`);
                                    irc.sayToChannel('#testing','Connection Timeout.');
                                })
                                .on('response', function(response) {
                                    if (response.statusCode != 200){
                                        irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error in response, status code: ${response.statusCode}`);
                                        console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Error in response, status code: ${response.statusCode}`);
                                    } else {
                                        irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stream started. Response OK, status code: ${response.statusCode}`);
                                        console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Stream started. Response OK, status code: ${response.statusCode}`);
                                        setWait(60000);
                                    }
                                    setStatusCode(response.statusCode);
                                })
                                .on('end', function() {
                                    if (getStatusCode() == 200) {
                                        irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Connection ended, restarting.`);
                                        console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Connection ended, restarting.`);
                                        exports.startStream(new nedb(config.nedb));
                                    } else
                                    if (getStatusCode() == 406) {
                                        irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Not following any accounts yet.`);
                                        console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Not following any accounts yet.`);
                                    } else
                                    if (getStatusCode() == 420) {
                                        irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] The client has connected too frequently or is reconnecting too fast. Retrying in ${getWait()/1000} seconds.`);
                                        console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] The client has connected too frequently or is reconnecting too fast. Retrying in ${getWait()/1000} seconds.`);
                                        setTimeout(function() { exports.startStream(new nedb(config.nedb));},getWait());
                                        setWait(2*getWait());
                                    } else
                                    if (getStatusCode() == 503) {
                                        irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Service Unavailable. A streaming server is temporarily overloaded. Retrying in 5 minutes`);
                                        console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Service Unavailable. A streaming server is temporarily overloaded. Retrying in 5 minutes`);
                                        setTimeout(function() { exports.startStream(new nedb(config.nedb));},300000);
                                    } else
                                    if (getStatusCode() == 500) {
                                        irc.sayToChannel('#testing',`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Server Error 500. Retrying in ${getWait()/1000} seconds.`);
                                        console.log(`[${new Date().toLocaleTimeString('en-us', dateOptions)}] Server Error 500. Retrying in ${getWait()/1000} seconds.`);
                                        setTimeout(function() { exports.startStream(new nedb(config.nedb));},getWait());
                                        setWait(2*getWait());
                                    } 
            
                                })
                                .pipe(p);
                                setPipe(p);
                                setStream(stream);
                            }
                        });
                    } else {
                        irc.sayToChannel('#testing',`Not following anyone, no rules defined yet.`);
                    }
                });
            }
        });
    });
};
