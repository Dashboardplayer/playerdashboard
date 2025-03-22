import mongoose from 'mongoose';

// Log Schema - Replaces logs table in Supabase
const logSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create and export Log model
const Log = mongoose.model('Log', logSchema);
export default Log;