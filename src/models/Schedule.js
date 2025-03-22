import mongoose from 'mongoose';

// Schedule Schema - Replaces schedule table in Supabase
const scheduleSchema = new mongoose.Schema({
  player_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Player'
  },
  scheduled_url: {
    type: String,
    required: true,
    trim: true
  },
  start_time: {
    type: Date,
    required: true
  },
  end_time: {
    type: Date,
    required: true
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

// Create and export Schedule model
const Schedule = mongoose.model('Schedule', scheduleSchema);
export default Schedule;