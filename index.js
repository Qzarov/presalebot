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


let query_to_delete = {}

bot.on('text', async (msg) => {
    const chat_id = msg.chat.id;
    let text = msg.text;
    const username = msg.from.username;

    if (!chat_id) {
        console.log('chat_id in msg is null');
        return;
    }

    console.log(new Date(), " user: ", username, " send: ", text)

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
    const from_msg_id = callbackQuery.message.message_id
    if (!query_to_delete[sender.id]) {
        query_to_delete[sender.id] = []
    }
    query_to_delete[sender.id].push(from_msg_id)
    console.log(new Date(), " user: ", sender.username, " send action: ", sender.action)

    if (sender.action.includes(':')) {
        const command = sender.action.split(':')[0]
        if (command === 'add_wallet') {
            const user_wallet = sender.action.split(':')[1]
            const answer = `Для подтверждения кошелька отправьте ${process.env.VERIFICATION_COST} TON на адрес \`${OWNER_ADDR}\`, после чего нажмите "Отправлено"`
            await bot.sendMessage(sender.id, answer, {
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

                    const answer1 = `Отлично, ваш кошелек добавлен!\n` +
                        `Теперь осталось дело за малым, необходимо выбрать NFT, которую вы хотите приобрести. 🤔\n\n` +
                        `У нас есть два вида NFT - это *Обычная* и *Легендарная*, мы уже рассказывали в чем разница между` +
                        `эти NFT в нашем [канале](https://t.me/meta_kotd)!\n` +
                        `Визуально каждая NFT в нашей коллекции уникальна, поэтому узнать, какую NFT вы получили, ты сможешь только после покупки! 😼\n\n` +
                        `После того как ты определился с выбором, ты можешь выбрать любую из двух NFT, для этого нажми *кнопку снизу*.`
                    const buttons = [{text: `Обычная`, callback_data: `buy_common`},{text: `Легендарная`, callback_data: `buy_rare`}]

                    bot.sendMessage(sender.id, answer1, {
                        disable_web_page_preview: false,
                        parse_mode: `Markdown`,
                        reply_markup: {
                            inline_keyboard: [
                                buttons
                            ]
                        }
                    }).then();
                    deleteMessages(sender.id)

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
    } else if (sender.action === 'no') {
        const answer = `Введите ваш кошелек в формате "/wallet адрес_кошелька"`
        bot.sendMessage(sender.id, answer, {}).then();
    } else if (sender.action === 'continue') {
        call_continue(sender.id)
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
    console.log(new Date(), " user ", username, " triggered cmd_handler_start")
    db.addUser(chatId, username, (is_new_user) => {});
    let answer = `*Добро пожаловать в бота коллекции МЕТА КО(Д)Т!* 🎉\n\n` +
                `Мы рады приветствовать тебя в уникальном мире *NFT*, где каждый токен дарит возможность насладиться новым опытом взаимодействия с Независимым Экспертом.\n\n` +
                `Здесь ты сможешь обнаружить и приобрести  ценные и интересные *NFT*, отражающие уникальные истории и творческие идеи нашей команды. Наша коллекция разнообразна и предлагает нечто особенное для каждого коллекционера.\n\n` +
                `Не упусти свой шанс стать частью этого захватывающего мира *NFT*. Доверься **МЕТА КО(Д)Т** и открой для себя необычный опыт, который превратит взаимодействие с Независимым Экспертом в настоящее приключение.\n\n` +
                `*Приятного исследования и приобретения уникальных NFT!* 💫`;
    const buttons = [{text: `Продолжить`, callback_data: `continue`}]
    bot.sendMessage(chatId, answer, {
        parse_mode: `Markdown`,
        reply_markup: {
            inline_keyboard: [
                buttons
            ]
        }
    }).then();
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

function call_continue(sender_id) {
    db.userHasWallet(sender_id, (has_wallet) => {
        let buttons, answer;
        console.log(`sender ${sender_id} has wallet: ${has_wallet}`)
        if (has_wallet) {
            answer = `Отлично, ваш кошелек добавлен!\n` +
                `Теперь осталось дело за малым, необходимо выбрать NFT, которую вы хотите приобрести. 🤔\n\n` +
                `У нас есть два вида NFT - это *Обычная* и *Легендарная*, мы уже рассказывали в чем разница между` +
                `эти NFT в нашем [канале](https://t.me/meta_kotd)!\n` +
                `Визуально каждая NFT в нашей коллекции уникальна, поэтому узнать, какую NFT вы получили, ты сможешь только после покупки! 😼\n\n` +
                `После того как ты определился с выбором, ты можешь выбрать любую из двух NFT, для этого нажми *кнопку снизу*.`
            buttons = [{text: `Обычная`, callback_data: `buy_common`},{text: `Легендарная`, callback_data: `buy_rare`}]
        } else {
            answer = `Чтобы начать покупки, необходимо добавить свой кошелек TON.`;
            buttons = [{text: 'Добавить кошелёк', callback_data: 'wallet'},]
        }
        bot.sendMessage(sender_id, answer, {
            disable_web_page_preview: true,
            parse_mode: `Markdown`,
            reply_markup: {
                resize_keyboard: true,
                inline_keyboard: [
                        buttons
                ]
            }
        }).then();
    });
}

function call_buy_common(sender_id) {
    db.getNotOwnedNfts((nfts) => {
        const nft = getRandomNft(nfts, 'common');
        const answer = `Для покупки 1 **Обычной** NFT отправьте ${COMMON_NFT_PRICE} TON на адрес \`${OWNER_ADDR}\`, после чего нажмите "Оплата отправлена".`;
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
    const answer = `Для покупки 1 *Легендарной* или 5 *Обычной* NFT отправьте ${RARE_NFT_PRICE} TON на адрес \`${OWNER_ADDR}\`, после чего нажмите "Оплата отправлена".`;
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
                console.log(`found transaction: ${trans_send}`)
                if (trans_send) {
                    const nft = getRandomNft(nfts, 'common');
                    console.log("random common: ", nft);

                    console.log(`set owner id:${sender_id} wallet:${user_wallet} for NFT id ${nft[0].id_nft}`);
                    await db.setNftOwner(nft[0].id_nft, sender_id, user_wallet)

                    console.log(`send ${nft[0].tier} nft addr:${nft[0].contract} to ${user_wallet}`);
                    await sendNft(user_wallet, nft[0].contract);

                    await bot.answerCallbackQuery(callback_id, {
                        parse_mode: `Markdown`,
                        text: `Поздравляем, NFT отправлена!`
                    }).then();

                    await deleteMessages(sender_id);

                    const answer = `*Поздравляем, вы приобрели NFT из коллекции МЕТА КО(Д)Т* 😻\n\n` +
                                    `Теперь вы можете посмотреть какая NFT вам досталась, подключив свой кошелек к сайту !!!, также ты можешь продать и обменять свою NFT на другую!\n\n` +
                                    `Следи за новостями в нашем [канале](https://t.me/meta_kotd)!\n` +
                                    `*Скоро там будут большие анонсы*🙀`
                    await bot.sendMessage(sender_id, answer, {
                        parse_mode: `Markdown`,
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
        db.userHasWallet(sender_id, async (has_wallet, user_wallet) => {
            await checkTransaction(user_wallet, OWNER_ADDR, RARE_NFT_PRICE, async (trans_send) => {
                if (trans_send) {
                    const nft = getRandomNft(nfts, 'rare');
                    console.log("random rare: ", nft);

                    for (let i = 0; i < nft.length; i++) {
                        // TODO fix for many nft sendin'
                        console.log(`${i}: set owner id:${sender_id} wallet:${user_wallet} for NFT id ${nft[i].id_nft}`);
                        await db.setNftOwner(nft[i].id_nft, sender_id, user_wallet);

                        console.log(`send ${nft[0].tier} nft addr:${nft[0].contract} to ${user_wallet}`);
                        await sendNft(user_wallet, nft[i].contract);
                    }

                    await bot.answerCallbackQuery(callback_id, {
                        parse_mode: `Markdown`,
                        text: `Поздравляем, NFT отправлена!`
                    }).then();

                    await deleteMessages(sender_id);

                    const answer = `*Поздравляем, вы приобрели NFT из коллекции МЕТА КО(Д)Т* 😻\n\n` +
                        `Теперь вы можете посмотреть какая NFT вам досталась, подключив свой кошелек к сайту !!!, также ты можешь продать и обменять свою NFT на другую!\n\n` +
                        `Следи за новостями в нашем [канале](https://t.me/meta_kotd)!\n` +
                        `*Скоро там будут большие анонсы*🙀`
                    await bot.sendMessage(sender_id, answer, {
                        parse_mode: `Markdown`
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

async function deleteMessages(chatId) {
    for (let i = query_to_delete[chatId].length; i > 0; i--) {
        let next_id = query_to_delete[chatId].pop()
        console.log(`deleting message ${next_id} in chat ${chatId}`)
        try {
            await bot.deleteMessage(chatId, next_id).then(r => {})
        } catch(err) {
            console.log(`Error while deleting message ${next_id}: ${err}`)
        }
    }
}