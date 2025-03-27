import mongoose from 'mongoose';
import crypto from 'crypto';

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(40).toString('hex')
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
refreshTokenSchema.index({ token: 1 });
refreshTokenSchema.index({ user: 1 });
refreshTokenSchema.index({ expiresAt: 1 });

// Instance methods
refreshTokenSchema.methods.isExpired = function() {
  return Date.now() >= this.expiresAt.getTime();
};

refreshTokenSchema.methods.isActive = function() {
  return !this.revokedAt && !this.isExpired();
};

// Static methods
refreshTokenSchema.statics.generateRefreshToken = async function(userId) {
  const token = new this({
    user: userId,
    token: crypto.randomBytes(40).toString('hex')
  });
  await token.save();
  return token;
};

refreshTokenSchema.statics.revokeToken = async function(token) {
  const refreshToken = await this.findOne({ token });
  if (refreshToken && refreshToken.isActive()) {
    refreshToken.revokedAt = new Date();
    await refreshToken.save();
    return true;
  }
  return false;
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken; 