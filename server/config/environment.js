const { secureLog } = require('../../src/utils/secureLogger');

function validateEnvironment() {
  const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI'];
  const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missingEnvVars.length > 0) {
    secureLog.error('Error: Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
  }

  const recommendedEnvVars = ['MAILJET_API_KEY', 'MAILJET_SECRET_KEY', 'EMAIL_FROM'];
  const missingRecommendedVars = recommendedEnvVars.filter((varName) => !process.env[varName]);
  if (missingRecommendedVars.length > 0) {
    secureLog.warn('Warning: Missing recommended environment variables:', missingRecommendedVars.join(', '));
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    secureLog.error('Error: JWT_SECRET must be at least 32 characters long for security');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && !process.env.PLAYER_DEVICE_API_KEY) {
    secureLog.error('Error: PLAYER_DEVICE_API_KEY is required in production to protect player device endpoints');
    process.exit(1);
  }

  if (process.env.PLAYER_DEVICE_API_KEY && process.env.PLAYER_DEVICE_API_KEY.length < 32) {
    secureLog.error('Error: PLAYER_DEVICE_API_KEY must be at least 32 characters long for production safety');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const cloudinaryVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const missingCloudinaryVars = cloudinaryVars.filter((varName) => !process.env[varName]);
    if (missingCloudinaryVars.length > 0) {
      secureLog.error('Error: Cloudinary configuration is required in production:', missingCloudinaryVars.join(', '));
      process.exit(1);
    }
  }
}

module.exports = { validateEnvironment };
