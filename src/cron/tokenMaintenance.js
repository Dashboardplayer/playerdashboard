import cron from 'node-cron';
import { clearExpiredTokens } from '../services/tokenDenylistService.js';
import RefreshToken from '../models/RefreshToken.js';

// Run token maintenance tasks
const runTokenMaintenance = async () => {
  try {
    // Clear expired tokens from Redis denylist
    await clearExpiredTokens();

    // Remove expired refresh tokens from database
    const result = await RefreshToken.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { revokedAt: { $ne: null } }
      ]
    });

    console.log(`Cleaned up ${result.deletedCount} expired refresh tokens from database`);
  } catch (error) {
    console.error('Token maintenance error:', error);
  }
};

// Schedule token maintenance to run every day at 3 AM
cron.schedule('0 3 * * *', runTokenMaintenance, {
  timezone: 'Europe/Amsterdam'
});

// Export for manual execution if needed
export default runTokenMaintenance; 