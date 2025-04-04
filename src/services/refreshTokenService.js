const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const { addToBlacklist } = require('./tokenBlacklistService');
const { secureLog } = require('../utils/secureLogger');

/**
 * Service for managing refresh tokens and implementing proper session management
 */

// Constants for token configuration
const ACCESS_TOKEN_EXPIRY = parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 900; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRY = parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 604800; // 7 days in seconds

/**
 * Generate an access token for a user
 * @param {Object} user - The user object
 * @returns {string} - The generated JWT token
 */
const generateAccessToken = (user) => {
  // Generate a unique JWT ID
  const jti = crypto.randomBytes(16).toString('hex');
  
  const payload = {
    sub: user._id,
    email: user.email,
    role: user.role,
    company_id: user.company_id,
    jti
  };
  
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    audience: 'player-dashboard-api',
    issuer: 'player-dashboard'
  });
  
  return { token, jti, expiresIn: ACCESS_TOKEN_EXPIRY };
};

/**
 * Generate a refresh token for a user
 * @param {string} userId - The user ID
 * @returns {Object} - The generated refresh token object
 */
const generateRefreshToken = async (userId) => {
  try {
    // Create a new refresh token
    const refreshToken = await RefreshToken.generateRefreshToken(userId);
    
    return {
      token: refreshToken.token,
      expiresAt: refreshToken.expiresAt
    };
  } catch (error) {
    secureLog.error('Error generating refresh token:', error);
    throw error;
  }
};

/**
 * Refresh an access token using a refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Object} - The new tokens
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    // Find the refresh token in the database
    const refreshTokenDoc = await RefreshToken.findOne({ token: refreshToken });
    
    // Check if the refresh token exists and is valid
    if (!refreshTokenDoc) {
      throw new Error('Invalid refresh token');
    }
    
    if (!refreshTokenDoc.isActive()) {
      throw new Error('Refresh token is expired or revoked');
    }
    
    // Get the user for this token
    const user = await User.findById(refreshTokenDoc.user);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Generate a new access token
    const { token: accessToken, jti, expiresIn } = generateAccessToken(user);
    
    // Implement refresh token rotation for better security
    // Only rotate if the token is older than 1 day
    const refreshTokenAgeInHours = (Date.now() - refreshTokenDoc.issuedAt.getTime()) / (1000 * 60 * 60);
    
    let newRefreshToken = null;
    
    if (refreshTokenAgeInHours >= 24) {
      // Generate a new refresh token
      newRefreshToken = await generateRefreshToken(user._id);
      
      // Revoke the old refresh token
      refreshTokenDoc.revokedAt = new Date();
      refreshTokenDoc.replacedByToken = newRefreshToken.token;
      await refreshTokenDoc.save();
    }
    
    return {
      accessToken,
      refreshToken: newRefreshToken ? newRefreshToken.token : refreshToken,
      expiresIn
    };
  } catch (error) {
    secureLog.error('Error refreshing access token:', error);
    throw error;
  }
};

/**
 * Revoke a refresh token
 * @param {string} refreshToken - The refresh token to revoke
 * @returns {boolean} - Whether the token was successfully revoked
 */
const revokeRefreshToken = async (refreshToken) => {
  try {
    return await RefreshToken.revokeToken(refreshToken);
  } catch (error) {
    secureLog.error('Error revoking refresh token:', error);
    throw error;
  }
};

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - The user ID
 * @returns {number} - The number of tokens revoked
 */
const revokeAllUserRefreshTokens = async (userId) => {
  try {
    const tokens = await RefreshToken.find({ 
      user: userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    });
    
    let revokedCount = 0;
    for (const token of tokens) {
      token.revokedAt = new Date();
      await token.save();
      revokedCount++;
    }
    
    return revokedCount;
  } catch (error) {
    secureLog.error('Error revoking all user refresh tokens:', error);
    throw error;
  }
};

/**
 * Clean up expired refresh tokens
 * @returns {number} - The number of tokens cleaned up
 */
const cleanupExpiredTokens = async () => {
  try {
    const result = await RefreshToken.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { revokedAt: { $ne: null } }
      ]
    });
    
    return result.deletedCount;
  } catch (error) {
    secureLog.error('Error cleaning up expired refresh tokens:', error);
    throw error;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  cleanupExpiredTokens
}; 