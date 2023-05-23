import TelegramBot from 'node-telegram-bot-api'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import {Database} from './db.js'
import {checkTransaction} from "./ton_connector.js"

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
            const answer = `Подтвердить кошелек <a href="https://tonscan.org/address/${arr[1]}">${arr[1]}</a>?`
            bot.sendMessage(chat_id, answer, {
                parse_mode: `HTML`,
                disable_web_page_preview: false,
                reply_markup: {
                    resize_keyboard: true,
                    inline_keyboard: [
                        [
                            {text: 'Подтвердить', callback_data: `add_wallet:${arr[1]}`},
                            {text: 'Нет', callback_data: `no`}
                        ]
                    ]
                }
            }).then();
        }
    }

});

bot.on('callback_query', async function onCallbackQuery(callbackQuery) {
    const sender = {
        id: callbackQuery.from.id,
        username: callbackQuery.from.username,
        action: callbackQuery.data,
    };

    if (sender.action.includes(':')) {
        const command = sender.action.split(':')[0]
        if (command === 'add_wallet') {
            const user_wallet = sender.action.split(':')[1]
            const answer = `Отправьте ${process.env.VERIFICATION_COST} TON на адрес \`${OWNER_ADDR}\`, после чего нажмите "Отправлено"`
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
        }
        if (command === 'check_wallet') {
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