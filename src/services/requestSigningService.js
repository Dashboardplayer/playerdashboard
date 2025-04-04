const crypto = require('crypto');

/**
 * Service to handle request signing for sensitive operations
 * Uses HMAC-SHA256 to sign requests with a timestamp and request-specific data
 */

// Cache for recently used signatures to prevent replay attacks
const signatureCache = new Map();
const SIGNATURE_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a signature for a request
 * @param {Object} payload - Request data to sign
 * @param {string} userId - The ID of the user making the request
 * @returns {Object} - Object containing signature and timestamp
 */
const signRequest = (payload, userId) => {
  // Create a timestamp for the signature
  const timestamp = Date.now();
  
  // Create a string to sign from the payload and timestamp
  const dataToSign = JSON.stringify({
    payload,
    timestamp,
    userId
  });
  
  // Create the signature using HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(dataToSign)
    .digest('hex');
  
  return {
    signature,
    timestamp
  };
};

/**
 * Verify a request signature
 * @param {Object} payload - Request data that was signed
 * @param {string} signature - The signature to verify
 * @param {number} timestamp - The timestamp when the signature was created
 * @param {string} userId - The ID of the user who made the request
 * @returns {boolean} - Whether the signature is valid
 */
const verifySignature = (payload, signature, timestamp, userId) => {
  // Check if the timestamp is too old (prevents replay attacks)
  const now = Date.now();
  if (now - timestamp > SIGNATURE_EXPIRY) {
    return false;
  }
  
  // Check if this signature has been used before (prevents replay attacks)
  const cacheKey = `${signature}-${userId}`;
  if (signatureCache.has(cacheKey)) {
    return false;
  }
  
  // Cache the signature
  signatureCache.set(cacheKey, timestamp);
  
  // Clean up old signatures
  setTimeout(() => {
    signatureCache.delete(cacheKey);
  }, SIGNATURE_EXPIRY);
  
  // Recreate the signature to verify it matches
  const dataToSign = JSON.stringify({
    payload,
    timestamp,
    userId
  });
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(dataToSign)
    .digest('hex');
  
  return signature === expectedSignature;
};

// Middleware to verify request signatures
const signatureMiddleware = (req, res, next) => {
  try {
    const { signature, timestamp } = req.headers;
    
    // Skip signature verification for non-sensitive operations or if disabled in development
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_SIGNATURE_VERIFICATION === 'true') {
      return next();
    }
    
    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing request signature' });
    }
    
    const payload = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const isValid = verifySignature(payload, signature, parseInt(timestamp), userId);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid request signature' });
    }
    
    next();
  } catch (error) {
    console.error('Error verifying signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Cleanup for expired signatures
setInterval(() => {
  const now = Date.now();
  signatureCache.forEach((timestamp, key) => {
    if (now - timestamp > SIGNATURE_EXPIRY) {
      signatureCache.delete(key);
    }
  });
}, 60000); // Run cleanup every minute

module.exports = {
  signRequest,
  verifySignature,
  signatureMiddleware
}; 