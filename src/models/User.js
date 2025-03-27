const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// User Schema - Replaces Supabase Auth
const userSchema = !isBrowser ? new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: function() {
      return this.isActive && !this.registrationToken;
    }
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  lastLogin: {
    type: Date
  },
  role: {
    type: String,
    enum: ['superadmin', 'bedrijfsadmin', 'user'],
    default: 'user'
  },
  company_id: {
    type: String,
    required: function() {
      return this.role !== 'superadmin';
    }
  },
  // Registration fields
  registrationToken: { type: String },
  registrationTokenExpires: { type: Date },
  isActive: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'active'], default: 'pending' },
  lastReminderSent: { type: Date },
  // Password reset fields
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // 2FA fields
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false // This ensures the secret is not returned in normal queries
  },
  twoFactorTempSecret: {
    type: String,
    select: false // Temporary secret used during 2FA setup
  },
  twoFactorPendingSetup: {
    type: Boolean,
    default: false
  }
}) : null;

// Add password handling methods if not in browser
if (!isBrowser && userSchema) {
  // Method to set password
  userSchema.methods.setPassword = async function(password) {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(password, salt);
    this.isActive = true;
    this.registrationToken = undefined;
    this.registrationTokenExpires = undefined;
    this.loginAttempts = 0;
    this.lockUntil = undefined;
  };

  // Method to verify password with secure comparison
  userSchema.methods.verifyPassword = async function(password) {
    if (this.isLocked()) {
      return false;
    }
    const isMatch = await bcrypt.compare(password, this.passwordHash);
    if (!isMatch) {
      await this.incrementLoginAttempts();
      return false;
    }
    // Reset login attempts on successful login
    if (this.loginAttempts > 0) {
      await this.resetLoginAttempts();
    }
    this.lastLogin = new Date();
    await this.save();
    return true;
  };

  // Check if account is locked
  userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
  };

  // Increment login attempts and lock account if necessary
  userSchema.methods.incrementLoginAttempts = async function() {
    // If previous lock has expired, reset attempts
    if (this.lockUntil && this.lockUntil < Date.now()) {
      await this.resetLoginAttempts();
      return;
    }
    
    this.loginAttempts += 1;
    
    // Lock account after 5 failed attempts
    if (this.loginAttempts >= 5) {
      this.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
    }
    
    await this.save();
  };

  // Reset login attempts
  userSchema.methods.resetLoginAttempts = async function() {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    await this.save();
  };

  // Pre-save middleware
  userSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
  });

  // Method to generate registration token
  userSchema.methods.generateRegistrationToken = function() {
    this.registrationToken = crypto.randomBytes(20).toString('hex'); // 20 bytes = 40 hex chars
    this.registrationTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    return this.registrationToken;
  };

  // Method to generate password reset token
  userSchema.methods.generateResetToken = function() {
    this.resetPasswordToken = crypto.randomBytes(20).toString('hex'); // 20 bytes = 40 hex chars
    this.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return this.resetPasswordToken;
  };

  // Static method to find by email
  userSchema.statics.findByEmail = async function(email) {
    return this.findOne({ email: email.toLowerCase() });
  };
}

// Create the actual model or a browser-compatible mock
let User;

if (!isBrowser) {
  // Server-side: Create the actual Mongoose model
  User = mongoose.model('User', userSchema);
} else {
  // Browser-side: Create a mock User model with compatible functions
  User = {
    find: async (query = {}) => {
      console.log('Browser mock: User.find called with', query);
      return [];
    },
    findOne: async (query) => {
      console.log('Browser mock: User.findOne called with', query);
      return null;
    },
    findById: async (id) => {
      console.log('Browser mock: User.findById called with', id);
      return null;
    },
    findByIdAndUpdate: async () => null,
    findByIdAndDelete: async () => null,
    findByEmail: async (email) => null
  };
}

module.exports = User;