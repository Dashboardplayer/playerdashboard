import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = new Redis(process.env.REDIS_URL || {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

// Token denylist functions
export const addToDenylist = async (jti, exp) => {
  const expiryInSeconds = exp - Math.floor(Date.now() / 1000);
  if (expiryInSeconds > 0) {
    await redisClient.set(`denylist:${jti}`, '1', 'EX', expiryInSeconds);
  }
};

export const isTokenDenylisted = async (jti) => {
  const result = await redisClient.get(`denylist:${jti}`);
  return result !== null;
};

export default redisClient; 