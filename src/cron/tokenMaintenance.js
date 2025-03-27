import cron from 'node-cron';
import { clearExpiredTokens } from '../services/tokenBlacklistService.js';
import RefreshToken from '../models/RefreshToken.js';

// Run token maintenance tasks
const runTokenMaintenance = async () => {
  try {
    // Clear expired tokens from blacklist
    const blacklistCleared = await clearExpiredTokens();
    console.log(`Cleaned up ${blacklistCleared} expired tokens from blacklist`);

    // Remove expired refresh tokens from database
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

// Schedule token maintenance to run every hour
cron.schedule('0 * * * *', runTokenMaintenance);

// Export for manual execution if needed
export default runTokenMaintenance; 