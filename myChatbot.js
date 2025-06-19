require('dotenv').config({ path: './config.env' });
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require('axios');
const twilio = require('twilio');
const Session = require('./dbSchema');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);
const TWILIO_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

const apiKey = process.env.DEEPSEEK_API_KEY;

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './index.html'));
});


 app.post('/whatsapp', async (req, res) => {
  const from = req.body.From; 
  const body = req.body.Body;

  try {
    let session = await Session.findOne({ phone: from });

    if (!session) {
      session = await Session.create({
        phone: from,
        conversation: [
          {
            role: 'system',
            content: 'Your name is John Ayodeji a funny tech bro'
          }
        ]
      });
    }

    session.conversation.push({ role: 'user', content: body });
    session.messageCount += 1;

    const data = {
      model: 'deepseek/deepseek-r1-0528:free',
      messages: session.conversation
    };

    await delay(1500);
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );


    const choices = response?.data?.choices;
        if (!choices || !choices[0] || !choices[0].message || !choices[0].message.content) {
          console.error("❌ Unexpected DeepSeek API response:", response.data);
          throw new Error("DeepSeek returned an invalid or empty response.");
        }

        const reply = choices[0].message.content;

    session.conversation.push({ role: 'assistant', content: reply });
    await session.save();

    await twilioClient.messages.create({
      from: TWILIO_NUMBER,
      to: from,
      body: reply
    });

    res.send('<Response></Response>');
  } catch (err) {
    console.error('❌ Error handling message:', err.message);

    await twilioClient.messages.create({
      from: TWILIO_NUMBER,
      to: from,
      body: err.message
    });

    res.send('<Response></Response>');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot running at port ${PORT}`);
});
