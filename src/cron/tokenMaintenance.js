const cron = require('node-cron');
const { clearExpiredTokens } = require('../services/tokenBlacklistService');
const RefreshToken = require('../models/RefreshToken');

const runTokenMaintenance = async () => {
  try {
    const blacklistCleared = await clearExpiredTokens();
    console.log(`Cleaned up ${blacklistCleared} expired tokens from blacklist`);

    const refreshResult = await RefreshToken.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { revokedAt: { $ne: null } }
      ]
    });

    console.log(`Cleaned up ${refreshResult.deletedCount} expired refresh tokens from database`);
  } catch (error) {
    console.error('Token maintenance error:', error);
  }
};

if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 * * * *', runTokenMaintenance);
}

module.exports = runTokenMaintenance;
