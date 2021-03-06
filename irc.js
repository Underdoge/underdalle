'use strict';

const
    joinImages = require("join-images"),
    fs = require("fs"),
    packageInf = require('./package'),
    IRC = require('irc-framework'),
    colors = require('irc-colors'),
    config = require('./config'),
    path = require('path'),
    host = config.irc.host,
    port = config.irc.port,
    nick = config.irc.nick,
    tls = config.irc.tls,
    pass = config.irc.pass,
    channels = [];

var
    needle = require('needle'),
    bot = new IRC.Client();

function postImage(to,from,prompt){
    let url = config.ghetty.url,
        data = {
            image:{
                file: path.join(__dirname,'images',to,'dalle.jpg'),
                content_type: 'image/jpeg'
            }
        },
        options = {
            multipart:true,
            json:true
        };
    needle.post(url, data, options, function(error, response, body) {
        if (!error && response.statusCode == 200){
            bot.say(to,`@${from} here you go: "${prompt}" ${body.href}`);
        } else {
            bot.say(to,`Ghetty error ${response.statusCode}: ${error}!.`);
        }
    });
    channels[to].running = false;
}
    
bot.on('error', function(err) {
    console.log(err);
});

bot.on('connected', function() {
    config.irc.channels.forEach( channel => {
        bot.join(channel);
        channels[channel] = { running: false };
    });
});

bot.on('message', function(event) {
    let
        from=event.nick,
        message=event.message,
        to=event.target;
    // if message is .dalle prompt
    if (message.match(/^\.dalle\s.+$/)) {
        let
            url = config.dalle.api_url,
            prompt = message.slice(7).trim(),
            buffer;
        // check if bot is not handling another call
        if (!channels[to].running){
            channels[to].running = true;
            bot.say(to,`Generating from "${prompt}" prompt...`);
            needle.post(url, {prompt: prompt},{json: true}, function(error, response) {
                if (!error && response.statusCode == 200){
                    // save 9 images
                    if (!fs.existsSync(path.join(__dirname,'images',to))){
                        fs.mkdirSync(path.join(__dirname,'images',to), { recursive: true });
                    }
                    for (let i=0; i < response.body.images.length ; i++){
                        buffer = Buffer.from(response.body.images[i], "base64");
                        fs.writeFileSync(path.join(__dirname,'images',to,`dall-e_result_${i}.jpg`), buffer);
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
                    joinImages.joinImages([path.join(__dirname,'images',to,'dall-e_result_0.jpg'), path.join(__dirname,'images',to,'dall-e_result_1.jpg'),path.join(__dirname,'images',to,'dall-e_result_2.jpg')],options_horizontal).then((img) => {
                        img.toFile(path.join(__dirname,'images',to,'row1.jpg'));
                        joinImages.joinImages([path.join(__dirname,'images',to,'dall-e_result_3.jpg'), path.join(__dirname,'images',to,'dall-e_result_4.jpg'),path.join(__dirname,'images',to,'dall-e_result_5.jpg')],options_horizontal).then((img) => {
                            img.toFile(path.join(__dirname,'images',to,'row2.jpg'));
                            joinImages.joinImages([path.join(__dirname,'images',to,'dall-e_result_6.jpg'), path.join(__dirname,'images',to,'dall-e_result_7.jpg'),path.join(__dirname,'images',to,'dall-e_result_8.jpg')],options_horizontal).then((img) => {
                                img.toFile(path.join(__dirname,'images',to,'row3.jpg'));
                                setTimeout(function(){
                                    joinImages.joinImages([path.join(__dirname,'images',to,'row1.jpg'),path.join(__dirname,'images',to,'row2.jpg'),path.join(__dirname,'images',to,'row3.jpg')],options_vertical).then((img) => {
                                        img.toFile(path.join(__dirname,'images',to,'dalle.jpg'));
                                        setTimeout(function(){postImage(to,from,prompt)},500);
                                    });
                                },500);
                            });
                        });
                    });
                } else {
                    if (response.statusCode == 524){
                        bot.say(to,`@${from} Dall-E Service is too Busy. Please try again later...`);
                    } else {
                        bot.say(to,`Dall-E Error ${response.statusCode}: ${response.statusMessage}`);
                    }
                    channels[to].running = false;
                }
            });
        } else {
            bot.say(to,`@${from} please wait for the current Dall-E request to complete.`);
        }
    }
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
