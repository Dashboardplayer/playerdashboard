const mongoose = require('mongoose');

// Player Schema - Replaces players table in Supabase
const playerSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  unique_device_id: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Allow null values but enforce uniqueness for non-null values
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
  },
  screenshot: {
    image_data: {
      type: String,
      default: null
    },
    public_id: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: null
    }
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }]
});

// Add indexes for frequently queried fields
playerSchema.index({ company_id: 1, is_online: 1 });
playerSchema.index({ last_seen: -1 });
playerSchema.index({ company_id: 1, last_seen: -1 });
playerSchema.index({ company_id: 1, createdAt: -1 });
playerSchema.index({ company_id: 1, device_id: 1 });
playerSchema.index({ groups: 1 });

// Create and export Player model
const Player = mongoose.model('Player', playerSchema);
module.exports = Player;
