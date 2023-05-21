import TelegramBot from 'node-telegram-bot-api'
import {Database} from './db.js'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

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
            const answer = `Ваш кошелек <a href="https://tonscan.org/address/${arr[1]}">${arr[1]}</a>. Подтвердить?`
            bot.sendMessage(chat_id, answer, {
                parse_mode: `HTML`,
                disable_web_page_preview: false,
                reply_markup: {
                    resize_keyboard: true,
                    inline_keyboard: [
                        [
                            {text: 'Подтвердить', callback_data: `wallet:${arr[1]}`},
                            {text: 'Нет', callback_data: `no`}
                        ]
                    ]
                }
            }).then();
        }
    }

});

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
    const sender = {
        id: callbackQuery.from.id,
        username: callbackQuery.from.username,
        action: callbackQuery.data,
        callback_id: callbackQuery.id,
    };
    // const msg = callbackQuery.message;

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
                answer += `\nВы можете купить одну обычную NFT, заплатив 10 TON, или заплатить 50 TON и получить либо 1 редкую NFT, либо 5 обычных.`
                buttons = [{text: '10 TON', callback_data: '10'},{text: '50 TON', callback_data: '50'}]
            } else {
                answer += `\nДля продолжения взаимодействия с ботом необходимо добавить ваш кошелек.`;
                buttons = [{text: 'Добавить кошелёк', callback_data: 'wallet'},]
            }

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
}