import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: true });

export function init() {
    bot.onText(/\/chat/, message => {
        bot.sendMessage(message.chat.id, `Chat ID is ${message.chat.id}.`);
    });

    console.log('Telegram bot initialized.');
}

export function sendTelegramMessage(message: string) {
    bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message);
}