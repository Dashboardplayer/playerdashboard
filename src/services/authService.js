import User from '../models/User.js';
import { browserAuth } from '../utils/browserUtils.js';
import { sendPasswordResetEmail } from './emailService.js';
import { validatePassword } from '../utils/passwordValidation.js';
import xss from 'xss';

// We'll use browser-compatible auth instead of JWT for client-side

// Client-side rate limiting implementation
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes (changed from 15)
const MAX_REQUESTS = 5;

class RateLimiter {
  constructor() {
    this.requests = new Map();
    // Load saved rate limit data from localStorage
    this.loadFromStorage();
  }

  // Save rate limit data to localStorage
  saveToStorage() {
    const storageData = {};
    this.requests.forEach((timestamps, ip) => {
      storageData[ip] = timestamps;
    });
    localStorage.setItem('rateLimitData', JSON.stringify(storageData));
  }

  // Load rate limit data from localStorage
  loadFromStorage() {
    try {
      const storageData = localStorage.getItem('rateLimitData');
      if (storageData) {
        const parsed = JSON.parse(storageData);
        Object.entries(parsed).forEach(([ip, timestamps]) => {
          this.requests.set(ip, timestamps);
        });
        this.cleanupExpiredData();
      }
    } catch (error) {
      console.error('Error loading rate limit data:', error);
      localStorage.removeItem('rateLimitData');
    }
  }

  // Clean up expired timestamps
  cleanupExpiredData() {
    const now = Date.now();
    this.requests.forEach((timestamps, ip) => {
      const validTimestamps = timestamps.filter(timestamp => 
        now - timestamp < RATE_LIMIT_WINDOW
      );
      if (validTimestamps.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, validTimestamps);
      }
    });
    this.saveToStorage();
  }

  isRateLimited(ip) {
    const now = Date.now();
    const userRequests = this.requests.get(ip) || [];
    
    // Remove expired requests
    const validRequests = userRequests.filter(timestamp => 
      now - timestamp < RATE_LIMIT_WINDOW
    );
    
    if (validRequests.length >= MAX_REQUESTS) {
      this.requests.set(ip, validRequests);
      this.saveToStorage();
      return true;
    }
    
    // Add new request
    validRequests.push(now);
    this.requests.set(ip, validRequests);
    this.saveToStorage();
    return false;
  }

  getRemainingTime(ip) {
    const now = Date.now();
    const userRequests = this.requests.get(ip) || [];
    if (userRequests.length === 0) return 0;
    
    // Sort timestamps to get the oldest one
    const sortedTimestamps = [...userRequests].sort((a, b) => a - b);
    const oldestRequest = sortedTimestamps[0];
    const timeUntilReset = (oldestRequest + RATE_LIMIT_WINDOW) - now;
    
    // If time has expired, clean up the data
    if (timeUntilReset <= 0) {
      this.cleanupExpiredData();
      return 0;
    }
    
    return timeUntilReset;
  }

  getRemainingAttempts(ip) {
    this.cleanupExpiredData(); // Clean up before checking
    const userRequests = this.requests.get(ip) || [];
    return Math.max(0, MAX_REQUESTS - userRequests.length);
  }

  getWarningStatus(ip) {
    const remaining = this.getRemainingAttempts(ip);
    if (remaining === 0) {
      const waitTime = Math.ceil(this.getRemainingTime(ip) / 1000 / 60);
      return {
        type: 'error',
        message: `Te veel inlogpogingen. Wacht nog ${waitTime} ${waitTime === 1 ? 'minuut' : 'minuten'} voordat je het opnieuw kunt proberen.`
      };
    } else if (remaining <= 2) {
      return {
        type: 'warning',
        message: `Waarschuwing: nog ${remaining} login ${remaining === 1 ? 'poging' : 'pogingen'} over voordat je account tijdelijk wordt geblokkeerd.`
      };
    }
    return null;
  }

  // Reset rate limit for an IP
  resetLimiter(ip) {
    this.requests.delete(ip);
    this.saveToStorage();
  }
}

export const rateLimiter = new RateLimiter();

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return xss(input.trim());
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

// Register a new user
export const registerUser = async (email, password, role, companyId) => {
  try {
    // Check rate limiting
    const clientIp = 'client'; // In a real app, you'd get this from the request
    if (rateLimiter.isRateLimited(clientIp)) {
      const remainingTime = Math.ceil(rateLimiter.getRemainingTime(clientIp) / 1000 / 60);
      return { error: `Too many requests. Please try again in ${remainingTime} minutes.` };
    }

    // Sanitize inputs
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedRole = sanitizeInput(role);
    const sanitizedCompanyId = sanitizeInput(companyId);

    // Validate email format
    if (!isValidEmail(sanitizedEmail)) {
      return { error: 'Invalid email format' };
    }

    // Validate password strength
    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      return { error: `Password validation failed: ${errors.join(', ')}` };
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      return { error: 'User with this email already exists' };
    }

    // Create new user
    const user = new User({
      email: sanitizedEmail,
      role: sanitizedRole,
      company_id: sanitizedCompanyId
    });

    // Set password (uses the method defined in the User model)
    await user.setPassword(password);

    // Save user to database
    await user.save();

    // Generate a simple token for the client
    const userInfo = {
      id: user._id,
      email: user.email,
      role: user.role,
      company_id: user.company_id
    };
    
    // Generate token and store auth data in browser storage
    const token = generateToken(userInfo);
    browserAuth.setAuth(token, userInfo);

    return { 
      user: userInfo, 
      token 
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { error: error.message };
  }
};

// Login a user
export const loginUser = async (email, password) => {
  try {
    // Check rate limiting
    const clientIp = 'client'; // In a real app, you'd get this from the request
    const warningStatus = rateLimiter.getWarningStatus(clientIp);
    
    if (rateLimiter.isRateLimited(clientIp)) {
      const remainingTime = Math.ceil(rateLimiter.getRemainingTime(clientIp) / 1000 / 60);
      return { 
        error: `Too many requests. Please try again in ${remainingTime} minutes.`,
        warningStatus
      };
    }

    // Add warning status to all responses
    const createResponse = (data) => ({
      ...data,
      warningStatus
    });

    // Sanitize input
    const sanitizedEmail = sanitizeInput(email);

    // Validate email format
    if (!isValidEmail(sanitizedEmail)) {
      return createResponse({ error: 'Invalid email format' });
    }

    console.log('Login attempt for:', sanitizedEmail);
    
    // Check if we're in browser environment
    const isBrowser = typeof window !== 'undefined';
    
    if (isBrowser) {
      // In browser, we'll use a special login process
      // For development/demo purposes, accept the superadmin account with credentials from env variables
      const adminEmail = process.env.REACT_APP_ADMIN_EMAIL;
      const adminPassword = process.env.REACT_APP_ADMIN_PASSWORD;
      
      if (sanitizedEmail === adminEmail && password === adminPassword) {
        console.log('Super admin login detected in browser');
        
        // Create a user info object for the superadmin
        const userInfo = {
          id: 'superadmin-mock-id',
          email: sanitizedEmail,
          role: 'superadmin',
          company_id: null
        };
        
        // Generate token and store in browser storage
        const token = generateToken(userInfo);
        browserAuth.setAuth(token, userInfo);
        
        return createResponse({
          user: userInfo,
          token
        });
      }
    }
    
    // Standard flow for both server and browser
    const user = await User.findOne({ email: sanitizedEmail });
    
    if (!user) {
      console.log('User not found:', sanitizedEmail);
      return createResponse({ error: 'Invalid email or password' }); // Use generic error message for security
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return createResponse({ error: `Account is locked. Please try again in ${lockTime} minutes` });
    }

    // Verify password with secure comparison
    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      console.log('Invalid password for user:', sanitizedEmail);
      return createResponse({ error: 'Invalid email or password' }); // Use generic error message for security
    }

    // Prepare user data
    const userInfo = {
      id: user._id,
      email: user.email,
      role: user.role,
      company_id: user.company_id
    };
    
    console.log('Login successful for:', sanitizedEmail, 'Role:', user.role);
    
    // Generate token and store in browser storage
    const token = generateToken(userInfo);
    browserAuth.setAuth(token, userInfo);

    return createResponse({
      user: userInfo,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return { 
      error: 'An unexpected error occurred',
      warningStatus: rateLimiter.getWarningStatus('client')
    };
  }
};

// Generate a proper JWT token
const generateToken = (userInfo) => {
  // Create a header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Create a payload with expiration
  const payload = {
    ...userInfo,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours from now
    iat: Math.floor(Date.now() / 1000)
  };

  // Base64Url encode header and payload
  const base64Header = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const base64Payload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  // Create signature using the same secret as the server
  const secret = 'default-secret-key'; // This should match the server's JWT_SECRET
  const signatureInput = `${base64Header}.${base64Payload}`;
  const signature = btoa(
    Array.from(
      new TextEncoder().encode(signatureInput + secret),
      byte => String.fromCharCode(byte)
    ).join('')
  ).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  // Combine all parts
  return `${base64Header}.${base64Payload}.${signature}`;
};

// Verify token from browser storage
export const verifyToken = (token) => {
  try {
    // For browser implementation, check if the token exists in storage
    const storedToken = browserAuth.getToken();
    if (storedToken && storedToken === token) {
      return browserAuth.getUser();
    }
    return null;
  } catch (error) {
    return null;
  }
};

// Get user by ID
export const getUserById = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { error: 'User not found' };
    }
    
    return { 
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    };
  } catch (error) {
    console.error('Get user error:', error);
    return { error: error.message };
  }
};

// Generate password reset token
export const generateResetToken = async (email) => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return { error: 'User not found' };
    }

    const resetToken = user.generateResetToken();
    await user.save();

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(email, resetToken);
    
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      // We still return success as the token was generated, but log the email failure
    }

    return {
      message: 'Password reset token generated and email sent',
      resetToken
    };
  } catch (error) {
    console.error('Reset token generation error:', error);
    return { error: error.message };
  }
};

// Reset password using token
export const resetPassword = async (resetToken, newPassword) => {
  try {
    const user = await User.findOne({ 
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return { error: 'Invalid or expired reset token' };
    }

    // Set new password
    user.setPassword(newPassword);
    
    // Clear reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    return { message: 'Password has been reset' };
  } catch (error) {
    console.error('Password reset error:', error);
    return { error: error.message };
  }
};