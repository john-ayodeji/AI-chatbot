require('dotenv').config({ path: './config.env' });
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require('axios');
const twilio = require('twilio');
const Session = require('./dbSchema');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

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
            content: 'You are a helpful WhatsApp chatbot assistant created by John Ayodeji.'
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

    const reply = response.data.choices[0].message.content;

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
      body: "Sorry, something went wrong with the bot."
    });

    res.send('<Response></Response>');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot running at http://localhost:${PORT}`);
});
