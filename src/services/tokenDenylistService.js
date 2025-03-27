const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS_ENABLED === 'true' ? {} : undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

const redisClient = new Redis(redisConfig);

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis Client Connected');
});

// Add a token to the denylist
const addToDenylist = async (jti, exp) => {
  try {
    const expiryInSeconds = exp - Math.floor(Date.now() / 1000);
    if (expiryInSeconds > 0) {
      await redisClient.set(`denylist:${jti}`, '1', 'EX', expiryInSeconds);
      console.log(`Token ${jti} added to denylist`);
    }
  } catch (error) {
    console.error('Error adding token to denylist:', error);
    throw error;
  }
};

// Check if a token is denylisted
const isTokenDenylisted = async (jti) => {
  try {
    const result = await redisClient.get(`denylist:${jti}`);
    return result !== null;
  } catch (error) {
    console.error('Error checking token denylist:', error);
    // In case of Redis errors, we treat the token as valid to prevent service disruption
    return false;
  }
};

// Clear expired tokens from denylist (maintenance function)
const clearExpiredTokens = async () => {
  try {
    const keys = await redisClient.keys('denylist:*');
    let cleared = 0;
    
    for (const key of keys) {
      const ttl = await redisClient.ttl(key);
      if (ttl <= 0) {
        await redisClient.del(key);
        cleared++;
      }
    }
    
    console.log(`Cleared ${cleared} expired tokens from denylist`);
  } catch (error) {
    console.error('Error clearing expired tokens:', error);
  }
};

module.exports = {
  redisClient,
  addToDenylist,
  isTokenDenylisted,
  clearExpiredTokens
}; 