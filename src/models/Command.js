const mongoose = require('mongoose');

// Command Schema - Replaces commands table in Supabase
const commandSchema = new mongoose.Schema({
  player_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Player'
  },
  command_type: {
    type: String,
    required: true,
    trim: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completed_at: {
    type: Date
  }
});

// Create and export Command model
const Command = mongoose.model('Command', commandSchema);
module.exports = Command;