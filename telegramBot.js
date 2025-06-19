require('dotenv').config({ path: './config.env' });
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const mongoose = require('mongoose');
const Session = require('./dbSchema'); 

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const apiKey = process.env.DEEPSEEK_API_KEY;

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;



  try {
    let session = await Session.findOne({ phone: chatId.toString() });
    if (!session) {
      session = await Session.create({
        phone: chatId.toString(),
        conversation: [
          { role: 'system', content: 'Your name is John Ayodeji a funny tech bro'}
        ]
      });
    }

    session.conversation.push({ role: 'user', content: userMessage });

    const data = {
      model: 'deepseek/deepseek-r1-0528:free',
      messages: session.conversation
    };

    await delay(1500);
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const choices = response?.data?.choices;

    if (!choices || !Array.isArray(choices) || !choices[0]) {
      console.error('❌ Unexpected DeepSeek API response:', response.data);
      return bot.sendMessage(chatId, '❌ Error handling message: DeepSeek returned an invalid or empty response.');
    }
    const reply = response.data.choices[0].message.content;

    session.conversation.push({ role: 'assistant', content: reply });
    void session.save();

    bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error('❌ Error:', err.message);
    bot.sendMessage(chatId, err.message);
  }
});
