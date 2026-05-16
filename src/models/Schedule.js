const mongoose = require('mongoose');

// Schedule Schema - Replaces schedule table in Supabase
const scheduleSchema = new mongoose.Schema({
  player_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Player'
  },
  scheduled_url: {
    type: String,
    trim: true
  },
  // Screen on/off scheduling
  screen_on: {
    type: Boolean,
    default: true
  },
  // Time-based scheduling
  start_time: {
    type: String, // Format: "HH:mm" for daily recurring
  },
  end_time: {
    type: String, // Format: "HH:mm" for daily recurring
  },
  // Days of week (0=Sunday, 6=Saturday)
  days_of_week: {
    type: [Number],
    default: [0, 1, 2, 3, 4, 5, 6] // All days by default
  },
  // Schedule type: 'content' or 'screen'
  type: {
    type: String,
    enum: ['content', 'screen'],
    default: 'content'
  },
  // Whether this schedule is active
  active: {
    type: Boolean,
    default: true
  },
  // Optional name for the schedule
  name: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to update the updatedAt field before save
scheduleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

scheduleSchema.index({ player_id: 1, active: 1, createdAt: -1 });
scheduleSchema.index({ player_id: 1, active: 1, days_of_week: 1 });

// Create and export Schedule model
const Schedule = mongoose.model('Schedule', scheduleSchema);
module.exports = Schedule;
