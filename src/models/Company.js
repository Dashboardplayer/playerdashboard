const mongoose = require('mongoose');

// Company Schema - Replaces companies table in Supabase
const companySchema = new mongoose.Schema({
  company_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true // Add index for faster lookups
  },
  company_name: {
    type: String,
    required: true,
    trim: true
  },
  contact_email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  contact_phone: {
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

// Add compound index for company_id and _id
companySchema.index({ company_id: 1, _id: 1 });

// Pre-save middleware to update timestamps
companySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to find by either _id or company_id
companySchema.statics.findByAnyId = async function(id) {
  let company = null;
  
  // Try ObjectId first
  if (mongoose.Types.ObjectId.isValid(id)) {
    company = await this.findById(id);
  }
  
  // If not found, try company_id
  if (!company) {
    company = await this.findOne({ company_id: id });
  }
  
  return company;
};

// Create and export Company model
const Company = mongoose.model('Company', companySchema);
module.exports = Company;