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
    enum: ['pending', 'delivered', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completed_at: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

commandSchema.index({ player_id: 1, status: 1, createdAt: 1 });
commandSchema.index({ player_id: 1, createdAt: -1 });
commandSchema.index({ status: 1, createdAt: 1 });

// Create and export Command model
const Command = mongoose.model('Command', commandSchema);
module.exports = Command;
