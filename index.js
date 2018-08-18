require('babel-polyfill');
const QRCode = require('qrcode');
const Eris = require('eris');
const Redite = require('redite');
const config = require('./config');
const db = new Redite({
    url: config.redisURL
});
const bot = new Eris(config.token, { restMode: true });
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const dutb = require('data-uri-to-buffer');

const success = '<:iccheck:435574370107129867>  |  ';
const error = '<:icerror:435574504522121216>  |  ';

const coins = {
    bitcoin: {
        regex: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
        short: 'BTC'
    },
    dogecoin: {
        regex: /D{1}[5-9A-HJ-NP-U]{1}[1-9A-HJ-NP-Za-km-z]{32}/,
        short: 'DOGE'
    },
    ethereum: {
        regex: /0x[a-fA-F0-9]{40}/,
        short: 'ETH'
    },
    ethereumclassic: {
        regex: /0x[a-fA-F0-9]{40}/,
        short: 'ETC'
    },
    litecoin: {
        regex: /[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}/,
        short: 'LTC'
    },
    bitcoincash: {
        regex: /[13][a-km-zA-HJ-NP-Z1-9]{33}/,
        short: 'BCH'
    },
    monero: {
        regex: /4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}/,
        short: 'XMR'
    },
    dash: {
        regex: /X[1-9A-HJ-NP-Za-km-z]{33}/,
        short: 'DASH'
    },
    ripple: {
        regex: /r[0-9a-zA-Z]{33}/,
        short: 'XRP'
    }
}

let weebshitMode = false;

const commands = {
    async help(msg) {
        await msg.channel.createMessage({embed: {
            title: 'CryptoBot Help',
            description: 'help - this message\ncredits - get some information about how the bot was made\naddress - set a coin address\naddresses - get addresses for yourself or another user\ncode - generate a QR code so that people can pay you cryptocurrency\ncoins - get supported coins\nprice - get a coin price',
            color: 0x36393f,
            footer: { text: 'https://github.com/ZeroIdeaDevelopment/CryptoBot' }
        }});
    },
    async credits(msg) {
        await msg.channel.createMessage({embed: {
            title: 'Credits',
            description: 'Some parts of the bot are powered by cryptocompare.com.\nRegexes for addresses are provided by k4m4\'s modules and/or community submission.',
            color: 0x36393f
        }})
    },
    async code(msg, args) {
        if (args.length < 1) {
            await msg.channel.createMessage('To generate a code, use `crypto code <coin>`. You can use `crypto coins` to see supported coins.');
        } else {
            if (coins[args[0]] !== undefined) {
                let hasAddressKey = await db[`addresses:${msg.author.id}`].exists();
                if (hasAddressKey) {
                    let addressExists = await db[`addresses:${msg.author.id}`][args[0]].exists();
                    if (addressExists) {
                        let address = await db[`addresses:${msg.author.id}`][args[0]].get;
                        let buf = dutb(await QRCode.toDataURL(address, { errorCorrectionLevel: 'H' }));
                        await msg.channel.createMessage({
                            embed: {
                                title: 'Address for ' + msg.author.username + ' (' + args[0] + ')',
                                image: { url: 'attachment://code.png' },
                                color: 0x36393f
                            }
                        }, { file: buf, name: 'code.png' });
                    } else {
                        await msg.channel.createMessage(error + 'You don\'t have an address set for that cryptocurrency! Set it using `crypto address ' + args[0] + ' <address>`.');
                    }
                } else {
                    await msg.channel.createMessage(error + 'You don\'t have any addresses set up!');
                }
            } else {
                await msg.channel.createMessage(error + 'That coin isn\'t supported. You can use `crypto coins` to see supported coins.');
            }
        }
    },
    async coins(msg) {
        let coinsSupported = '**I support...**\n';
        for (let coin in coins) {
            coinsSupported += '\n' + coin + ' (' + coins[coin].short + ')';
        }
        await msg.channel.createMessage({embed: {
            title: 'Coins Supported',
            description: coinsSupported,
            footer: { text: 'When using a command with the parameter "coin", provide the full name (such as bitcoin).', icon_url: 'attachment://coin.png' },
            color: 0x36393f
        }}, { file: await require('util').promisify(fs.readFile)(path.resolve('./img/bitcoin.png')), name: 'coin.png' });
    },
    async address(msg, args) {
        if (args.length < 2) {
            await msg.channel.createMessage('To set an address, use `crypto address <coin> <address>`. You can use `crypto coins` to see supported coins.');
        } else {
            if (coins[args[0]] !== undefined) {
                if (coins[args[0]].regex.test(args[1])) {
                    await db[`addresses:${msg.author.id}`][args[0]].set(args[1]);
                    await msg.channel.createMessage(success + 'Address set!');
                } else {
                    await msg.channel.createMessage(error + 'That doesn\'t look like a valid address for that cryptocurrency.');
                }
            } else {
                await msg.channel.createMessage(error + 'That coin isn\'t supported. You can use `crypto coins` to see supported coins.');
            }
        }
    },
    async addresses(msg, args) {
        if (args.length < 1) {
            let hasAddressKey = await db[`addresses:${msg.author.id}`].exists();
            if (hasAddressKey) {
                let addresses = await db[`addresses:${msg.author.id}`].get;
                let msgStr = '**The addresses are...**';
                for (let coin in addresses) {
                    msgStr += '\n**';
                    msgStr += coin;
                    msgStr += '**: ';
                    msgStr += addresses[coin];
                }
                await msg.channel.createMessage({embed: {
                    title: !weebshitMode ? 'Addresses for ' + msg.author.username : 'H-here\'s the addresses for ' + msg.author.username + ', s-senpai~',
                    description: msgStr,
                    color: 0x36393f
                }});
            } else {
                await msg.channel.createMessage(error + 'You don\'t have any addresses set up!');
            }
        } else {
            let id = args[0].match(/[<@]*(\d+)>*/);
            if (id.length > 1) {
                let hasAddressKey = await db[`addresses:${id[1]}`].exists();
                if (hasAddressKey) {
                    let addresses = await db[`addresses:${id[1]}`].get;
                    let msgStr = '**The addresses are...**';
                    for (let coin in addresses) {
                        msgStr += '\n**';
                        msgStr += coin;
                        msgStr += '**: ';
                        msgStr += addresses[coin];
                    }
                    await msg.channel.createMessage({
                        embed: {
                            title: !weebshitMode ? 'Addresses for ' + (await bot.getRESTUser(id[1])).username : 'H-here\'s the addresses for ' + (await bot.getRESTUser(id[1])).username + ', s-senpai~',
                            description: msgStr,
                            color: 0x36393f
                        }
                    });
                } else {
                    await msg.channel.createMessage(error + 'That user doesn\'t have any addresses set up!');
                }
            } else {
                await msg.channel.createMessage(error + 'Mention a user or use an ID to get their addresses!');
            }
        }
    },
    async price(msg, args) {
        if (args.length < 1) {
            await msg.channel.createMessage('To get the price of a coin, use `crypto price [amount] <coin>`. You can use `crypto coins` to see supported coins.');
        } else {
            let amount = 1;
            if (args.length === 2) {
                if (!isNaN(parseFloat(args[0])))
                    amount = parseFloat(args[0]);
                else return await msg.channel.createMessage(error + 'That\'s not a valid amount.');
                args.shift();
            }
            if (coins[args[0]] !== undefined) {
                let res = await fetch('https://min-api.cryptocompare.com/data/price?fsym=' + coins[args[0]].short + '&tsyms=USD,GBP,EUR,JPY', {
                    method: 'GET'
                });
                let json = await res.json();
                let value = '';
                value += ':dollar: ' + (json.USD * amount).toFixed(2) + ' USD\n';
                value += ':pound: ' + (json.GBP * amount).toFixed(2) + ' GBP\n';
                value += ':euro: ' + (json.EUR * amount).toFixed(2) + ' EUR\n';
                value += ':yen: ' + (json.JPY * amount).toFixed(2) + ' JPY';
                await msg.channel.createMessage({embed: {
                    title: !weebshitMode ? 'Price Conversion' : 'Here\'s the prices for you, s-senpai~',
                    thumbnail: { url: 'attachment://coin.png' },
                    //description: '1 ' + coins[args[0]].short + ' is worth ' + json.USD + ' USD.',
                    fields: [
                        {
                            name: amount + ' ' + coins[args[0]].short + ' is worth...',
                            value
                        }
                    ],
                    color: 0x36393f
                }}, { file: await require('util').promisify(fs.readFile)(path.resolve('./img/' + args[0] + '.png')), name: 'coin.png' });
            } else {
                await msg.channel.createMessage(error + 'That coin isn\'t supported. You can use `crypto coins` to see supported coins.');
            }
        }
    },
    async die(msg) {
        if (msg.author.id === '96269247411400704') {
            await msg.channel.createMessage(success + 'CryptoBot is restarting...');
            require('child_process').exec('pm2 restart cryptobot');
        }
    },
    async weebshit(msg) {
        if (msg.author.id === '96269247411400704') {
            weebshitMode = !weebshitMode;
            await msg.channel.createMessage(success + 'Weebshit mode toggled.' + (weebshitMode ? ' I hope you know what you\'re doing.' : ''));
        }
    }
}

bot.on('messageCreate', async msg => {
    if (msg.author.bot) return;
    if (msg.content.startsWith('crypto ')) {
        let args = msg.content.split(' ');
        args.shift();
        let cmd = args[0];
        args.shift();
        if (commands[cmd] !== undefined) {
            await commands[cmd](msg, args);
        }
    }
});

bot.connect();

bot.on('ready', () => {
    bot.editStatus({
        name: 'the prices of cryptocurrency | crypto help',
		type: 3
    }); // Watching the prices of cryptocurrency | crypto help
});