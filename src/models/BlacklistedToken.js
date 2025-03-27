const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  blacklistedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    enum: ['LOGOUT', 'SECURITY_CONCERN', 'PASSWORD_CHANGE', 'ADMIN_ACTION'],
    required: true
  }
});

// Create compound index for faster queries
blacklistedTokenSchema.index({ jti: 1, expiresAt: 1 });

// Add method to check if token is expired
blacklistedTokenSchema.methods.isExpired = function() {
  return Date.now() >= this.expiresAt.getTime();
};

// Static method to clean up expired tokens
blacklistedTokenSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

// Static method to blacklist a token
blacklistedTokenSchema.statics.blacklistToken = async function(jti, expiresAt, userId, tokenHash, reason) {
  return await this.create({
    jti,
    expiresAt,
    userId,
    tokenHash,
    reason
  });
};

// Static method to check if a token is blacklisted
blacklistedTokenSchema.statics.isBlacklisted = async function(jti) {
  const token = await this.findOne({ 
    jti,
    expiresAt: { $gt: new Date() }
  });
  return !!token;
};

const BlacklistedToken = mongoose.model('BlacklistedToken', blacklistedTokenSchema);

module.exports = BlacklistedToken; 