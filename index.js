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
const vm = require('vm');

const success = '<:iccheck:435574370107129867>  |  ';
const error = '<:icerror:435574504522121216>  |  ';
const info = '<:icinfo:435576029680238593>  |  ';
const working = '<a:icworking:440090198500573184>  |  ';

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

let usersMining = [];

let weebshitMode = false;

const commands = {
    async help(msg) {
        await msg.channel.createMessage({embed: {
            title: 'CryptoBot Help',
            description: 'help - this message\ncredits - get some information about how the bot was made\naddress - set a coin address\naddresses - get addresses for yourself or another user\ncode - generate a QR code so that people can pay you cryptocurrency\ncoins - get supported coins\nprice - get a coin price\nshapeshift - turn one coin into another\nv - vCurrency',
            color: 0x36393f,
            footer: { icon_url: 'attachment://shapeshift.png', text: 'ShapeShift onboard | https://github.com/ZeroIdeaDevelopment/CryptoBot' }
        }}, { file: await require('util').promisify(fs.readFile)(path.resolve('./img/shapeshift.png')), name: 'shapeshift.png' });
    },
    async credits(msg) {
        await msg.channel.createMessage({embed: {
            title: 'Credits',
            description: 'Some parts of the bot are powered by cryptocompare.com.\nRegexes for addresses are provided by k4m4\'s modules and/or community submission.\n<@103832588556193792> (jmeel#2147) for making the profile picture.',
            color: 0x36393f
        }})
    },
    async code(msg, args) {
        if (args.length < 1) {
            await msg.channel.createMessage(info + 'To generate a code, use `crypto code <coin>`. You can use `crypto coins` to see supported coins.');
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
            await msg.channel.createMessage(info + 'To set an address, use `crypto address <coin> <address>`. You can use `crypto coins` to see supported coins.');
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
            await msg.channel.createMessage(info + 'To get the price of a coin, use `crypto price [amount] <coin>`. You can use `crypto coins` to see supported coins.');
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
                    timestamp: new Date(),
                    color: 0x36393f
                }}, { file: await require('util').promisify(fs.readFile)(path.resolve('./img/' + args[0] + '.png')), name: 'coin.png' });
            } else {
                await msg.channel.createMessage(error + 'That coin isn\'t supported. You can use `crypto coins` to see supported coins.');
            }
        }
    },
    async shapeshift(msg, args) {
        if (args.length < 2) {
            await msg.channel.createMessage(info + 'To change one coin into another, use `crypto shapeshift <input coin> <output coin>`. You can use `crypto coins` to see supported coins.');
        } else {
            if (coins[args[0]] !== undefined) {
                if (coins[args[1]] !== undefined) {
                    let hasAddressKey = await db[`addresses:${msg.author.id}`].exists();
                    if (hasAddressKey) {
                        let addresses = await db[`addresses:${msg.author.id}`].get;
                        let inputAddr = addresses[args[0]];
                        let outputAddr = addresses[args[1]];
                        if (inputAddr !== undefined) {
                            if (outputAddr !== undefined) {
                                let m = await msg.channel.createMessage(working + 'Creating your transaction, this may take a minute...');
                                let body1 = {
                                    pair: coins[args[0]].short + '_' + coins[args[1]].short,
                                    withdrawal: outputAddr,
                                    returnAddress: inputAddr
                                };
                                let res1 = await fetch('https://shapeshift.io/shift', {
                                    method: 'POST',
                                    body: JSON.stringify(body1),
                                    headers: { 'Content-Type': 'application/json' }
                                });
                                let res2 = await fetch('https://shapeshift.io/rate/' + body1.pair);
                                let res3 = await fetch('https://shapeshift.io/limit/' + body1.pair);
                                let json1 = await res1.json();
                                let json2 = await res2.json();
                                let json3 = await res3.json();
                                let embed = {
                                    title: 'ShapeShift',
                                    thumbnail: { url: 'https://info.shapeshift.io/sites/default/files/fav_icon.png' },
                                    description: 'You are converting from ' + json1.depositType + ' to ' + json1.withdrawalType + '. This transaction will timeout after 5 minutes and CryptoBot will stop updating its status.',
                                        fields: [
                                            {
                                                name: 'Deposit Address',
                                                value: json1.deposit,
                                                inline: true
                                            },
                                            {
                                                name: 'Withdrawal Address',
                                                value: json1.withdrawal,
                                                inline: true
                                            },
                                            {
                                                name: 'Conversion Rate',
                                                value: '1 ' + json1.depositType + ' is ' + json2.rate + ' ' + json1.withdrawalType
                                            },
                                            {
                                                name: 'Limit',
                                                value: 'You can convert up to ' + json3.limit + ' ' + json1.depositType
                                            }
                                        ],
                                            color: 0x36393f
                                };
                                if (json1.error !== undefined) {
                                    m.edit(error + 'There was an issue creating your transaction. Please try again later.');
                                } else {
                                    await m.edit({ content: '', embed });
                                    let interval = null;
                                    let transactionTimeout = null;
                                    let initialDesc = embed.description;
                                    embed.description += '\n\n' + working + 'Awaiting deposit...'
                                    await m.edit({ content: '', embed });
                                    transactionTimeout = setTimeout(async () => {
                                        clearInterval(interval);
                                        embed.description = initialDesc;
                                        embed.description += '\n\n' + error + 'The transaction has timed out and CryptoBot will stop listening to any events relating to it.'
                                        await m.edit({ content: '', embed });
                                    }, 1000 * 60 * 5);
                                    interval = setInterval(async () => {
                                        let status = await fetch('https://shapeshift.io/txStat/' + json1.deposit);
                                        let json = await status.json();
                                        if (json.status !== 'no_deposits') {
                                            if (json.status === 'received') {
                                                embed.description = initialDesc;
                                                embed.description += '\n\n' + working + 'ShapeShift has received the deposit. It is now being exchanged.'
                                                clearTimeout(transactionTimeout); // can't cancel after this point, might as well clear it
                                                console.log(json1.deposit + ' is now in status `received`.');
                                            } else if (json.status === 'complete') {
                                                embed.description = initialDesc;
                                                embed.description += '\n\n' + success + 'ShapeShift has finished the exchange.'
                                                clearInterval(interval);
                                                console.log(json1.deposit + ' is now in status `complete`.');
                                            }
                                            await m.edit({ content: '', embed });
                                        }
                                    }, 30000);
                                    
                                }
                            } else {
                                await msg.channel.createMessage(error + 'You don\'t have an address set up for the output coin!');
                            }
                        } else {
                            await msg.channel.createMessage(error + 'You don\'t have an address set up for the input coin!');
                        }
                    } else {
                        await msg.channel.createMessage(error + 'You don\'t have any addresses set up!');
                    }
                } else {
                    await msg.channel.createMessage(error + 'The output coin isn\'t supported. You can use `crypto coins` to see supported coins.');
                }
            } else {
                await msg.channel.createMessage(error + 'The input coin isn\'t supported. You can use `crypto coins` to see supported coins.');
            }
        }
    },
    async v(msg, args) {
        if (args.length < 1) {
            await msg.channel.createMessage(info + 'This is the command for the entirety of CryptoBot\'s vCurrency (known as CBC). Get started by running `crypto v openaccount` to open an account! Use `crypto v help` to get more information on commands.');
        } else {
            let hasAccount = await db[`account:${msg.author.id}`].exists();
            switch (args[0]) {
                case 'help':
                await msg.channel.createMessage({
                    embed: {
                        title: 'CryptoBot vCurrency Help',
                        description: 'help - this message\nopenaccount - open an account\ncloseaccount - close an account\nbalance - get how much CBC you have\nmine - mine some CBC',
                        color: 0x36393f
                    }
                });
                break;

                case 'openaccount':
                if (hasAccount) {
                    await msg.channel.createMessage(error + 'You already have an account!');
                } else {
                    let accCreationMsg = await msg.channel.createMessage(working + 'Creating your account...');
                    await db[`account:${msg.author.id}`].accountTotal.set(0);
                    await accCreationMsg.edit(success + 'You have opened an account with CryptoBot vCurrency. Run `crypto v help` to get more information!');
                }
                break;

                case 'closeaccount':
                
                if (!hasAccount) {
                    await msg.channel.createMessage(error + 'You don\'t have an account!');
                } else {
                    if (args.length < 2) {
                        await msg.channel.createMessage('<:ictrash:445293877629419532>  |  Are you sure you want to close your account? Run this command again with the `confirm` argument if you are sure. You will lose all CBC inside your account.');
                    } else { 
                        if (args[1] === 'confirm') {
                            let accDeletionMsg = await msg.channel.createMessage(working + 'Closing your account...');
                            await db[`account:${msg.author.id}`].delete();
                            await accDeletionMsg.edit(success + 'You have closed your account with CryptoBot vCurrency.');
                        } else {
                            await msg.channel.createMessage(error + 'Invalid arguments.'); 
                        }
                    }
                }
                break;

                case 'mine':
                if (!hasAccount) {
                    await msg.channel.createMessage(error + 'You don\'t have an account! Run `crypto v openaccount` to make one!');
                } else {
                    await db[`account:${msg.author.id}`].isMining.delete();
                    let isMining = usersMining.includes(msg.author.id);
                    if (isMining) {
                        await msg.channel.createMessage(error + 'You\'re already mining!');
                    } else {
                        let miningMsg = await msg.channel.createMessage(working + 'Mining, this takes between 1 and 2 minutes...');
                        let min = Math.ceil(60);
                        let max = Math.floor(120);
                        let randomizedTime = Math.floor(Math.random() * (max - min)) + min;
                        console.log('mining for ' + randomizedTime + ' seconds');
                        setTimeout(async () => {
                            let res = await fetch('https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=BTC', {
                                method: 'GET'
                            });
                            let json = await res.json();
                            let amount = json.BTC;
                            let prevTotal = await db[`account:${msg.author.id}`].accountTotal.get;
                            await db[`account:${msg.author.id}`].accountTotal.set(prevTotal + amount);
                            usersMining.splice(usersMining.indexOf(msg.author.id), 1);
                            let awardMsg = success + 'You have been given ' + amount + ' CBC! Check your balance using `crypto v balance`.';
                            await miningMsg.edit(awardMsg);
                            let dm = await bot.getDMChannel(msg.author.id);
                            dm.createMessage(awardMsg);
                        }, randomizedTime * 1000);
                        usersMining.push(msg.author.id);
                    }
                }
                break;

                case 'balance':
                if (!hasAccount) {
                    await msg.channel.createMessage(error + 'You don\'t have an account! Run `crypto v openaccount` to make one!');
                } else {
                    let balance = await db[`account:${msg.author.id}`].accountTotal.get;
                    await msg.channel.createMessage('You have ' + balance + ' CBC.');
                }
                break;

                case 'trade':
                if (!hasAccount) {
                    await msg.channel.createMessage(error + 'You don\'t have an account! Run `crypto v openaccount` to make one!');
                } else {
                    let balance = await db[`account:${msg.author.id}`].accountTotal.get;
                    if (balance < 0.00001) {
                        await msg.channel.createMessage(error + 'You don\'t have enough CBC to trade! You need at least 0.00001 CBC!');
                    } else {
                        if (args.length < 3) {
                            await msg.channel.createMessage(info + 'Provide the user ID (or mention) of the user you want to transfer CBC to, and the amount of CBC! `crypto v transfer <user id/mention> <amount>`');
                        } else {
                            let id = args[1].match(/[<@]*(\d+)>*/);
                            if (id.length > 1) {
                                let targetHasAccount = await db[`account:${id[1]}`].exists();
                                if (!targetHasAccount) {
                                    await msg.channel.createMessage(error + 'Your target doesn\'t have an account!');
                                } else {
                                    let targetBalance = await db[`account:${id[1]}`].accountTotal.get;
                                    let amountToTrade = parseFloat(args[2]);
                                    if (isNaN(amountToTrade)) {
                                        await msg.channel.createMessage(error + 'That\'s not a valid amount.');
                                    } else {
                                        if (amountToTrade < 0.00001) {
                                            await msg.channel.createMessage(error + 'You need to trade at least 0.00001 CBC!');
                                        } else {
                                            if (balance >= amountToTrade) {
                                                let transferMsg = await msg.channel.createMessage(working + 'Transferring ' + amountToTrade + ' CBC to ' + (await bot.getRESTUser(id[1])).username + '...');
                                                await db[`account:${msg.author.id}`].accountTotal.set(balance - amountToTrade);
                                                await db[`account:${id[1]}`].accountTotal.set(targetBalance + amountToTrade);
                                                await transferMsg.edit(success + amountToTrade + ' CBC transferred successfully to ' + (await bot.getRESTUser(id[1])).username + '!');
                                            } else {
                                                await msg.channel.createMessage(error + 'You do not have that much CBC!');
                                            }
                                        }
                                    }
                                }
                            } else {
                                await msg.channel.createMessage(error + 'Mention a user or use an ID to trade with them!');
                            }
                        }
                    }
                }
                break;

                default:
                await msg.channel.createMessage(error + 'Invalid command! Run `crypto v help` for help!');
                break;
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
    },
    async eval(msg, args) {
        if (msg.author.id === '96269247411400704') {
            let context = {
                ctx: {
                    bot,
                    msg,
                    channel: msg.channel,
                    db
                }
            }
            let out = '```';
            try {
                vm.runInNewContext(`function execute() {
    ${args.join(' ')}
}

result = execute();`, context, { filename: 'cryptobot.vm' });
                out += context.result;
            } catch (e) {
                out += e.stack;
            }
            out += '```';
            await msg.channel.createMessage(out);
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

function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}