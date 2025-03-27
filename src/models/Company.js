const mongoose = require('mongoose');

// Company Schema - Replaces companies table in Supabase
const companySchema = new mongoose.Schema({
  company_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
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
  }
});

// Create and export Company model
const Company = mongoose.model('Company', companySchema);
module.exports = Company;