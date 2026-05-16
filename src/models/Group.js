const mongoose = require('mongoose');

// Group Schema - For organizing players into groups
const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Company'
  },
  color: {
    type: String,
    default: '#1976d2' // Default blue color
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
groupSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

groupSchema.index({ company_id: 1, createdAt: -1 });

// Create and export Group model
const Group = mongoose.model('Group', groupSchema);
module.exports = Group;
