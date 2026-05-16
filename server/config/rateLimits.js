const rateLimit = require('express-rate-limit');

const rateLimitConfig = {
  mutation: { windowMs: 15 * 60 * 1000, max: 100, message: 'Te veel mutatie verzoeken. Probeer het later opnieuw.' },
  query: { windowMs: 1 * 60 * 1000, max: 300, message: 'Te veel data verzoeken. Probeer het later opnieuw.' },
  realtime: { windowMs: 1 * 60 * 1000, max: 600, message: 'Te veel real-time verzoeken. Probeer het later opnieuw.' },
  auth: { windowMs: 5 * 60 * 1000, max: 5, message: 'Te veel inlogpogingen. Probeer het over 5 minuten opnieuw.' },
  login: { windowMs: 15 * 60 * 1000, max: 10, message: 'Te veel inlogpogingen. Probeer het later opnieuw.' },
  heartbeat: { windowMs: 1 * 60 * 1000, max: 60, message: 'Te veel heartbeat verzoeken.' }
};

const keyGenerator = (req) => req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

const createLimiter = (config) => rateLimit({
  windowMs: config.windowMs,
  max: config.max,
  message: { error: config.message },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator
});

const mutationLimiter = createLimiter(rateLimitConfig.mutation);
const queryLimiter = createLimiter(rateLimitConfig.query);
const realtimeLimiter = createLimiter(rateLimitConfig.realtime);

const mutationLimiterMiddleware = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return mutationLimiter(req, res, next);
  }
  return next();
};

const rateLimitHeadersMiddleware = (req, res, next) => {
  res.header('X-RateLimit-Limit', req.rateLimit?.limit);
  res.header('X-RateLimit-Remaining', req.rateLimit?.remaining);
  res.header('X-RateLimit-Reset', req.rateLimit?.reset);
  next();
};

module.exports = {
  rateLimitConfig,
  mutationLimiterMiddleware,
  queryLimiter,
  realtimeLimiter,
  rateLimitHeadersMiddleware
};
