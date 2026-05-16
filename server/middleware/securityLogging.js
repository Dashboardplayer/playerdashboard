const { secureLog } = require('../../src/utils/secureLogger');

const maskIP = (ip) => {
  if (!ip) return 'unknown';
  if (ip === '::1' || ip === '127.0.0.1') return 'localhost';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  return '***';
};

const securityLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();

  const sensitivePaths = ['/api/auth/login', '/api/auth/register', '/api/players'];
  if (sensitivePaths.some((path) => req.path.startsWith(path))) {
    secureLog.info('Security request', {
      ip: maskIP(req.ip),
      method: req.method,
      path: req.path,
      userAgent: req.get('user-agent')
    });
  }

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (res.statusCode >= 400) {
      secureLog.warn('Request failed', {
        ip: maskIP(req.ip),
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`
      });
    }
  });

  next();
};

module.exports = { securityLoggingMiddleware };
