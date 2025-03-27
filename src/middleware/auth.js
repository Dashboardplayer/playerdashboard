const jwt = require('jsonwebtoken');
const { isTokenBlacklisted } = require('../services/tokenBlacklistService');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided or invalid format' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        audience: 'player-dashboard-api',
        issuer: 'player-dashboard',
        clockTolerance: 30
      });
      
      // Check if token is blacklisted
      const isBlacklisted = await isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }

      // Enhanced validation
      if (!decoded.sub) {
        return res.status(403).json({ error: 'Invalid token format' });
      }

      // Find the user
      const user = await User.findById(decoded.sub);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ error: 'User account is disabled' });
      }

      // Add token and user info to request
      req.token = token;
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: user.role,
        company_id: decoded.company_id,
        jti: decoded.jti
      };
      
      next();
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      return res.status(401).json({ error: 'Token verification failed' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware for specific roles
const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Please authenticate' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = {
  auth,
  authorize
}; 