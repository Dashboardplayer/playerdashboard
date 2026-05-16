const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  issuedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  revokedAt: {
    type: Date,
    default: null
  },
  replacedByToken: {
    type: String,
    default: null
  }
});

// Add indexes
refreshTokenSchema.index({ token: 1 }, { unique: true });
refreshTokenSchema.index({ user: 1 });
refreshTokenSchema.index({ expiresAt: 1 });

refreshTokenSchema.statics.hashToken = function(token) {
  return crypto
    .createHash('sha256')
    .update(String(token))
    .digest('hex');
};

// Instance methods
refreshTokenSchema.methods.isExpired = function() {
  return Date.now() >= this.expiresAt.getTime();
};

refreshTokenSchema.methods.isActive = function() {
  return !this.revokedAt && !this.isExpired();
};

// Static methods
refreshTokenSchema.statics.generateRefreshToken = async function(userId) {
  const plainToken = crypto.randomBytes(40).toString('hex');
  const refreshToken = new this({
    user: userId,
    token: this.hashToken(plainToken)
  });
  await refreshToken.save();
  refreshToken.plainToken = plainToken;
  return refreshToken;
};

refreshTokenSchema.statics.findByToken = async function(token) {
  const tokenHash = this.hashToken(token);
  return this.findOne({
    $or: [
      { token: tokenHash },
      // Temporary backwards compatibility for refresh tokens issued before hashing.
      { token }
    ]
  });
};

refreshTokenSchema.statics.revokeToken = async function(token) {
  const refreshToken = await this.findByToken(token);
  if (refreshToken && refreshToken.isActive()) {
    refreshToken.revokedAt = new Date();
    await refreshToken.save();
    return true;
  }
  return false;
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken; 
