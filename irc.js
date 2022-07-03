'use strict';

const
    joinImages = require("join-images"),
    fs = require("fs"),
    packageInf = require('./package'),
    IRC = require('irc-framework'),
    colors = require('irc-colors'),
    config = require('./config'),
    host = config.irc.host,
    port = config.irc.port,
    nick = config.irc.nick,
    tls = config.irc.tls,
    pass = config.irc.pass

var
    generating = false,
    request = require('request'),
    bot = new IRC.Client();

function postImage(to){
    const options = {
        url: config.ghetty.url,
        json: true
    }
    let req = request.post(options, function (err, resp,body) {
        if (err) {
            console.log(err);
            console.log('Error!');
        } else {
            bot.say(to,body.href);
        }
    });
    let form = req.form();
    form.append('file', fs.createReadStream(`dalle.jpg`));
    generating=false;
}
    
bot.on('error', function(err) {
    console.log(err);
});

bot.on('connected', function() {
    config.irc.channels.forEach( channel => {
        bot.join(channel);
    });
});

bot.on('message', function(event) {
    let
        from=event.nick,
        message=event.message,
        to=event.target;
    // if message is a valid .dalle XXXXX string
         if (message.match(/^\.dalle\s.+$/)) {
            // if message is .dalle prompt
            if (message.match(/^\.dalle\s.+$/)) {
                let
                    url = config.dalle.api_url,
                    prompt = message.slice(7);
                // check if bot is not handling another call
                if (!generating){
                    generating = true;
                    bot.say(to,`Generating from "${prompt}" prompt...`);
                    request.post({url, json: {'prompt':prompt}}, function(err, r, response) {
                        if (err) {
                            bot.say(to,`Error: ${err}`);
                            throw Error(err);
                        }
                        if (response) {
                            // save 9 images
                            for (let i=0; i < response.images.length ; i++){
                                let buffer = Buffer.from(response.images[i], "base64");
                                fs.writeFileSync(`dall-e_result_${i}.jpg`, buffer);
                            }
                            const options_horizontal = {
                                direction:"horizontal",
                                color: 0x00000000,
                                align: 'left', 
                                offset: 5
                                },
                                options_vertical = {
                                    direction:"vertical",
                                    color: 0x00000000,
                                    align: 'left', 
                                    offset: 5
                                };
                            // join 9 images into a single 3x3 grid image
                            joinImages.joinImages(['dall-e_result_0.jpg', 'dall-e_result_1.jpg','dall-e_result_2.jpg'],options_horizontal).then((img) => {
                                img.toFile('row1.jpg');
                                joinImages.joinImages(['dall-e_result_3.jpg', 'dall-e_result_4.jpg','dall-e_result_5.jpg'],options_horizontal).then((img) => {
                                    img.toFile('row2.jpg');
                                    joinImages.joinImages(['dall-e_result_6.jpg', 'dall-e_result_7.jpg','dall-e_result_8.jpg'],options_horizontal).then((img) => {
                                        img.toFile('row3.jpg');
                                        setTimeout(function(){
                                            joinImages.joinImages(['row1.jpg','row2.jpg','row3.jpg'],options_vertical).then((img) => {
                                                img.toFile('dalle.jpg');
                                                setTimeout(function(){postImage(to)},500);
                                            });
                                        },500);
                                    });
                                });
                            });
                        } else {
                            // no results found
                            generating = false;
                            bot.say(to,`No results for ${prompt}!.`);
                        }
                    });
                } else {
                    bot.say(to,`Please wait for the current Dall-E request to complete...`);
                }
            } else
                bot.say(to,'Invalid command.');
        } else
        // if message is .help
        if (message.match(/^\.help$/)) {
            bot.say(from,'Usage:');
            setTimeout(function() { bot.say(from,'.dalle <prompt> - request dall-e images from prompt');},500);
            setTimeout(function() { bot.say(from,'.help - this help message.');},500);
        } else
        if (message.match(/^\.bots$/)) {
            bot.say(to,`${config.irc.nick} [NodeJS], a Dall-E mini bot for irc. Do .help for usage.`);
        } else
        if (message.match(/^\.source$/)) {
            bot.say(to,`${config.irc.nick} [NodeJS] :: ${colors.white.bold('Source ')} ${packageInf.repository}`);
        }
});

bot.on('registered', function (){
    bot.say('nickserv','identify '+ pass);
})

bot.connect({host,port,tls,nick});
