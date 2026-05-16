const mongoose = require('mongoose');

// Log Schema - Replaces logs table in Supabase
const logSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  player_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: false
  },
  action: {
    type: String,
    required: true,
    trim: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  old_value: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  new_value: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for automatic cleanup of logs older than 3 days
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 }); // 3 days

// Create and export Log model
const Log = mongoose.model('Log', logSchema);
module.exports = Log;
