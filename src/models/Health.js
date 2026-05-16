const mongoose = require('mongoose');

// Health Schema - For tracking device health metrics
const healthSchema = new mongoose.Schema({
  player_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Player'
  },
  cpu_usage: {
    type: Number, // Percentage 0-100
    default: 0
  },
  memory_usage: {
    type: Number, // Percentage 0-100
    default: 0
  },
  storage_usage: {
    type: Number, // Percentage 0-100
    default: 0
  },
  storage_total: {
    type: Number, // Total storage in bytes
    default: 0
  },
  storage_free: {
    type: Number, // Free storage in bytes
    default: 0
  },
  uptime: {
    type: Number, // Uptime in seconds
    default: 0
  },
  battery_level: {
    type: Number, // Battery percentage 0-100
    default: null
  },
  battery_charging: {
    type: Boolean,
    default: false
  },
  temperature: {
    type: Number, // Temperature in Celsius
    default: null
  },
  network_type: {
    type: String, // wifi, mobile, ethernet, etc.
    default: null
  },
  network_strength: {
    type: Number, // Signal strength 0-100
    default: null
  },
  app_version: {
    type: String,
    default: null
  },
  android_version: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add indexes for efficient queries
healthSchema.index({ player_id: 1, createdAt: -1 });
healthSchema.index({ createdAt: -1 });
// TTL index to automatically delete records older than 7 days (for scalability)
healthSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Create and export Health model
const Health = mongoose.model('Health', healthSchema);
module.exports = Health;
