import TelegramBot from 'node-telegram-bot-api'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import {Database} from './db.js'
import {checkTransaction, get_collection_nfts, sendNft} from "./ton_connector.js"

dotenv.config()

const OWNER_ADDR = process.env.OWNER_ADDR
const COMMON_NFT_PRICE = process.env.COMMON_NFT_PRICE
const RARE_NFT_PRICE = process.env.RARE_NFT_PRICE

const db = new Database();
const bot = new TelegramBot(process.env.BOT_TOKEN, {polling: true});
const app = express();

app.use(express.json());
app.use(cors())

bot.on('text', async (msg) => {
    const chat_id = msg.chat.id;
    let text = msg.text;
    const username = msg.from.username;

    if (!chat_id) {
        console.log('chat_id in msg is null');
        return;
    }

    if (text[0] === "/") {
        const arr = text.split(" ");
        const command = arr[0];

        if (command === '/start') {
            cmd_handler_start(chat_id, username);
        } else if (command === '/wallet') {
            cmd_handler_wallet(chat_id, arr[1]);
        } else if (command === '/get_collection_nfts') {
            const nfts = await get_collection_nfts(process.env.COLLECTION_ADDR)
            for (let i = 0; i < nfts.length; i++) {
                db.addNft(nfts[i].id, nfts[i].address, nfts[i].tier, (err) => {
                    console.log("err while addin' nfts: ", err)
                });
            }
        }
    }

});

bot.on('callback_query', async function onCallbackQuery(callbackQuery) {
    const sender = {
        id: callbackQuery.from.id,
        username: callbackQuery.from.username,
        action: callbackQuery.data,
    };

    console.log("user: ", sender.username, " send action: ", sender.action)

    if (sender.action.includes(':')) {
        const command = sender.action.split(':')[0]
        if (command === 'add_wallet') {
            const user_wallet = sender.action.split(':')[1]
            const answer = `Для подтверждения кошелька отправьте ${process.env.VERIFICATION_COST} TON на адрес \`${OWNER_ADDR}\`, после чего нажмите "Отправлено"`
            bot.sendMessage(sender.id, answer, {
                parse_mode: `Markdown`,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Отправлено', callback_data: `check_wallet:${user_wallet}`},
                        ]
                    ]
                }
            }).then();
        } else if (command === 'check_wallet') {
            const user_wallet = sender.action.split(':')[1]
            await checkTransaction(user_wallet, OWNER_ADDR, process.env.VERIFICATION_COST, (trans_send) => {
                if (trans_send) {
                    const wallet = sender.action.split(':')[1]
                    db.setUserWallet(sender.id, wallet)
                    bot.answerCallbackQuery(callbackQuery.id, {
                        text: `Ваш кошелек успешно добавлен`,
                    }).then();
                    cmd_handler_start(sender.id, sender.username)
                } else {
                    bot.answerCallbackQuery(callbackQuery.id, {
                        text: `Транзакция не найдена, нажмите повторно через 10 секунд`,
                    }).then();
                }
            }).then();
        }
     }

    if (sender.action === 'wallet') {
        const answer = `Введите ваш кошелек в формате "/wallet адрес_кошелька"`
        bot.sendMessage(sender.id, answer, {}).then();
    } else if (sender.action === `buy_common`) {
        call_buy_common(sender.id)
    } else if (sender.action === `buy_rare`) {
        call_buy_rare(sender.id)
    } else if (sender.action === `send_common`) {
        call_send_common(sender.id, callbackQuery.id)
    } else if (sender.action === `send_rare`) {
        call_send_rare(sender.id, callbackQuery.id);
    }
});

function cmd_handler_start(chatId, username) {
    db.addUser(chatId, username, (is_new_user) => {
        let answer = `Привет, ${username}!`;
        db.userHasWallet(chatId, (has_wallet) => {
            let buttons;
            if (has_wallet) {
                answer += `\nВы можете купить одну обычную NFT, заплатив ${COMMON_NFT_PRICE} TON, или заплатить ${RARE_NFT_PRICE} TON и получить либо 1 редкую NFT, либо 5 обычных`
                buttons = [{text: `${COMMON_NFT_PRICE} TON`, callback_data: `buy_common`},{text: `${RARE_NFT_PRICE} TON`, callback_data: `buy_rare`}]
            } else {
                answer += `\nДля продолжения взаимодействия с ботом необходимо добавить ваш кошелек`;
                buttons = [{text: 'Добавить кошелёк', callback_data: 'wallet'},]
            }

            db.getNotOwnedNfts((nfts) => {
                answer += `\n\nДоступно NFT: ${nfts.common.length} common и ${nfts.rare.length} rare`
                bot.sendMessage(chatId, answer, {
                    reply_markup: {
                        resize_keyboard: true,
                        inline_keyboard: [
                            buttons
                        ]
                    }
                }).then();
            });
        });
    });
}

function cmd_handler_wallet(chat_id, wallet) {
    const answer = `Подтвердить кошелек <a href="https://tonscan.org/address/${wallet}">${wallet}</a>?`
    bot.sendMessage(chat_id, answer, {
        parse_mode: `HTML`,
        disable_web_page_preview: false,
        reply_markup: {
            resize_keyboard: true,
            inline_keyboard: [
                [
                    {text: 'Подтвердить', callback_data: `add_wallet:${wallet}`},
                    {text: 'Нет', callback_data: `no`}
                ]
            ]
        }
    }).then();
}

function call_buy_common(sender_id) {
    db.getNotOwnedNfts((nfts) => {
        const nft = getRandomNft(nfts, 'common');
        const answer = `Для покупки 1 common NFT отвравьте ${COMMON_NFT_PRICE} TON на адрес \`${OWNER_ADDR}\`, после чего нажмите "Оплата отправлена".`;
        bot.sendMessage(sender_id, answer, {
            parse_mode: `Markdown`,
            reply_markup: {
                resize_keyboard: true,
                inline_keyboard: [
                    [
                        {text: 'Оплата отправлена', callback_data: `send_common`},
                    ]
                ]
            }
        }).then();
    })
}

function call_buy_rare(sender_id) {
    const answer = `Для покупки 1 rare или 5 common NFT отвравьте ${RARE_NFT_PRICE} TON на адрес \`${OWNER_ADDR}\`, после чего нажмите "Оплата отправлена".`;
    bot.sendMessage(sender_id, answer, {
        parse_mode: `Markdown`,
        reply_markup: {
            resize_keyboard: true,
            inline_keyboard: [
                [
                    {text: 'Оплата отправлена', callback_data: `send_rare`},
                ]
            ]
        }
    }).then();
}

function call_send_common(sender_id, callback_id) {
    db.getNotOwnedNfts((nfts) => {
        db.userHasWallet(sender_id, async (has_wallet, user_wallet) => {
            await checkTransaction(user_wallet, OWNER_ADDR, COMMON_NFT_PRICE, async (trans_send) => {
                if (trans_send) {
                    const nft = getRandomNft(nfts, 'common');

                    console.log("random common: ", nft);

                    console.log(`set owner id:${sender_id} wallet:${user_wallet} for NFT id ${nft[0].id_nft}`);
                    await db.setNftOwner(nft[0].id_nft, sender_id, user_wallet)

                    console.log(`send ${nft[0].tier} nft addr:${nft[0].contract} to ${user_wallet}`);
                    await sendNft(user_wallet, nft[0].contract);
                    bot.answerCallbackQuery(callback_id, {
                        text: `Поздравляем, NFT отправлена!`,
                    }).then();
                } else {
                    bot.answerCallbackQuery(callback_id, {
                        text: `Транзакция не найдена, нажмите повторно через 10 секунд`,
                    }).then();
                }
            }).then();
        });
    });
}

function call_send_rare(sender_id, callback_id) {
    db.getNotOwnedNfts((nfts) => {
        const nft = getRandomNft(nfts, 'rare');
        db.userHasWallet(sender_id, async (has_wallet, user_wallet) => {
            await checkTransaction(user_wallet, OWNER_ADDR, RARE_NFT_PRICE, async (trans_send) => {
                if (trans_send) {
                    console.log("random rare: ", nft);

                    for (let i = 0; i < nft.length; i++) {
                        // TODO fix for many nft sendin'
                        console.log(`${i}: set owner id:${sender_id} wallet:${user_wallet} for NFT id ${nft[i].id_nft}`);
                        await db.setNftOwner(nft[i].id_nft, sender_id, user_wallet);

                        console.log(`send ${nft[0].tier} nft addr:${nft[0].contract} to ${user_wallet}`);
                        await sendNft(user_wallet, nft[i].contract);
                    }
                    bot.answerCallbackQuery(callback_id, {
                        text: `Поздравляем, NFT отправлена!`,
                    }).then();
                } else {
                    bot.answerCallbackQuery(callback_id, {
                        text: `Транзакция не найдена, нажмите повторно через 10 секунд`,
                    }).then();
                }
            }).then();
        });
    });
}

function getRandomNft(nfts, tier) {
    console.log(`get random ${tier} nft`)

    let result = [];
    if (tier === 'common') {
        const random_int = Math.floor(Math.random() * (nfts.common.length-1));
        result.push(nfts.common[random_int])
        return result;
    } else if (tier === 'rare') {
        const random_int = Math.floor(Math.random() * (nfts.rare.length - 1));

        if (nfts.common.length >= 5) {
            const return_rare = Math.floor(Math.random() * (2));
            console.log("return_rare: ", return_rare)

            // if (false) {
            if (return_rare) {
                result.push(nfts.rare[random_int])
                console.log("returned nfts: ", result)
                return result;
            } else {
                for (let i = 0; i < 1; i++) { // TODO set 5 nfts
                    const random_int = Math.floor(Math.random() * (nfts.common.length - 1));
                    const nft = nfts.common.splice(random_int,1)
                    result.push(nft[0]);
                }
                console.log("returned nfts: ", result)
                return result;
            }

        } else {
            console.log("returned nfts: ", result)
            return result.push(nfts.rare[random_int]);
        }
    }
}