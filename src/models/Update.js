import mongoose from 'mongoose';

// Update Schema - Replaces updates table in Supabase
const updateSchema = new mongoose.Schema({
  player_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Player'
  },
  update_type: {
    type: String,
    required: true,
    trim: true
  },
  version: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'failed'],
    default: 'pending'
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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
updateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create and export Update model
const Update = mongoose.model('Update', updateSchema);
export default Update;