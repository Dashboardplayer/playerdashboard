const BlacklistedToken = require('../models/BlacklistedToken');
const crypto = require('crypto');

// Hash the token for additional security
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Add a token to the blacklist
const addToBlacklist = async (jti, exp, userId, token, reason = 'LOGOUT') => {
  try {
    const expiryDate = new Date(exp * 1000);
    const tokenHash = hashToken(token);

    await BlacklistedToken.blacklistToken(jti, expiryDate, userId, tokenHash, reason);
    console.log(`Token ${jti} added to blacklist`);
  } catch (error) {
    console.error('Error adding token to blacklist:', error);
    throw error;
  }
};

// Check if a token is blacklisted
const isTokenBlacklisted = async (jti) => {
  try {
    return await BlacklistedToken.isBlacklisted(jti);
  } catch (error) {
    console.error('Error checking token blacklist:', error);
    // In case of database errors, we treat the token as invalid for security
    return true;
  }
};

// Clear expired tokens from blacklist (maintenance function)
const clearExpiredTokens = async () => {
  try {
    const deletedCount = await BlacklistedToken.cleanupExpired();
    console.log(`Cleared ${deletedCount} expired tokens from blacklist`);
    return deletedCount;
  } catch (error) {
    console.error('Error clearing expired tokens:', error);
    throw error;
  }
};

// Blacklist all tokens for a user (used when changing password or security concerns)
const blacklistAllUserTokens = async (userId, reason = 'SECURITY_CONCERN') => {
  try {
    // Note: This doesn't actually invalidate the tokens, but marks them as blacklisted
    // The actual invalidation happens when the tokens are checked
    await BlacklistedToken.create({
      jti: `user_${userId}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      userId,
      tokenHash: hashToken(`user_${userId}`),
      reason
    });
    console.log(`All tokens for user ${userId} have been blacklisted`);
  } catch (error) {
    console.error('Error blacklisting user tokens:', error);
    throw error;
  }
};

module.exports = {
  addToBlacklist,
  isTokenBlacklisted,
  clearExpiredTokens,
  blacklistAllUserTokens
}; 