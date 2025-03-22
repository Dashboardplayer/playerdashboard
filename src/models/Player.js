import mongoose from 'mongoose';

// Player Schema - Replaces players table in Supabase
const playerSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  company_id: {
    type: String,
    required: true,
    trim: true,
    ref: 'Company'
  },
  current_url: {
    type: String,
    trim: true
  },
  is_online: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  last_seen: {
    type: Date,
    default: Date.now
  }
});

// Create and export Player model
const Player = mongoose.model('Player', playerSchema);
export default Player;