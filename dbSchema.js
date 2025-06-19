const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['system', 'user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true
  },
  conversation: {
    type: [messageSchema],
    default: []
  },
  messageCount: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

sessionSchema.pre('save', function (next) {
  this.lastUpdated = new Date();
  next();
});

const Session = mongoose.model('Session', sessionSchema);
module.exports = Session;
