import User from '../models/User.js';
import { browserAuth } from '../utils/browserUtils.js';
import { sendPasswordResetEmail } from './emailService.js';
import { validatePassword } from '../utils/passwordValidation.js';
import xss from 'xss';
import { jwtDecode } from 'jwt-decode';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken';
import { addToBlacklist, blacklistAllUserTokens } from './tokenBlacklistService';
import { generateUUID } from '../utils/uuidUtils.js';

// WebSocket Configuration
const WS_URL = process.env.NODE_ENV === 'production' 
  ? `wss://${window.location.host}`
  : `ws://localhost:5001`;

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds

let ws = null;
let reconnectAttempts = 0;

// WebSocket message handler
const handleWebSocketMessage = (message) => {
  // Ignore heartbeat messages
  if (message.type === 'heartbeat') return;

  console.log('Received WebSocket message:', message);

  switch (message.type) {
    case 'auth_expired':
      browserAuth.clearAuth();
      window.location.href = '/login';
      break;
    case 'user_updated':
      // Handle user updates
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
};

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

  resetAttempts(ip) {
    this.requests.delete(ip);
    this.saveToStorage();
  }

  increment(ip) {
    const now = Date.now();
    const userRequests = this.requests.get(ip) || [];
    userRequests.push(now);
    this.requests.set(ip, userRequests);
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

// Generate JWT token with JTI (JWT ID)
const generateToken = (user) => {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    { 
      id: user._id,
      email: user.email,
      role: user.role,
      jti
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: '15m' // Shorter lived access tokens
    }
  );
  return { token, jti };
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

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Create new user
    const user = new User({
      email: sanitizedEmail,
      password,
      role: sanitizedRole,
      company_id: sanitizedCompanyId
    });

    await user.save();
    const { token, jti } = generateToken(user);
    
    // Generate refresh token
    const refreshToken = await RefreshToken.generateRefreshToken(user._id);

    return {
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      },
      token,
      refreshToken: refreshToken.token
    };
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Store both tokens
browserAuth.setAuth = (accessToken, refreshToken, user) => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));
};

// Clear both tokens
browserAuth.clearAuth = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('auth_logout'));
};

// Get tokens
browserAuth.getTokens = () => ({
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken')
});

// Login a user with enhanced security
export const loginUser = async (email, password) => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid login credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid login credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    const { token, jti } = generateToken(user);
    const refreshToken = await RefreshToken.generateRefreshToken(user._id);

    return {
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      },
      token,
      refreshToken: refreshToken.token
    };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Refresh access token
export const refreshAccessToken = async (refreshToken) => {
  try {
    const token = await RefreshToken.findOne({ token: refreshToken });
    if (!token || !token.isActive()) {
      throw new Error('Invalid refresh token');
    }

    const user = await User.findById(token.user);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Generate new access token
    const { token: newToken, jti } = generateToken(user);

    return {
      token: newToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
};

// Verify token and handle refresh
export const verifyToken = async () => {
  try {
    const { accessToken, refreshToken } = browserAuth.getTokens();
    if (!accessToken || !refreshToken) {
      return null;
    }

    // Check if token is expired
    const decoded = jwtDecode(accessToken);
    const currentTime = Date.now() / 1000;
    
    if (decoded.exp < currentTime) {
      // Token is expired, try to refresh
      const refreshResult = await refreshAccessToken(refreshToken);
      if (refreshResult.error) {
        return null;
      }
      return refreshResult.user;
    }

    return browserAuth.getUser();
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
};

// Get user by ID
export const getUserById = async (userId) => {
  try {
    const user = browserAuth.getUser();
    if (!user || !user.token) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(`http://localhost:5001/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${user.token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Failed to get user' };
    }

    return { user: data };
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
    await user.setPassword(newPassword);
    
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

// Initialize WebSocket connection
function initializeWebSocket() {
  try {
    const user = browserAuth.getUser();
    if (!user || !user.token) {
      console.log('No authenticated user for WebSocket connection');
      return;
    }

    // Close existing connection if any
    if (ws) {
      ws.close();
      ws = null;
    }

    // Create WebSocket with secure protocol
    const protocols = [`jwt.${user.token}`]; // Use sub-protocol for token transmission
    ws = new WebSocket(WS_URL, protocols);
    
    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      reconnectAttempts = 0; // Reset attempts on successful connection
      
      // Send an initial authentication message
      ws.send(JSON.stringify({
        type: 'authenticate',
        token: user.token,
        timestamp: Date.now(),
        clientId: generateUUID(),
        userId: user.id
      }));
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code);
      
      // Handle authentication errors
      if (event.code === 1008) { // Policy violation (e.g., invalid token)
        browserAuth.clearAuth();
        window.location.href = '/login';
        return;
      }

      // Attempt reconnection if not max attempts
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => {
          reconnectAttempts++;
          console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          initializeWebSocket();
        }, RECONNECT_DELAY);
      } else {
        console.log('Max reconnection attempts reached');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  } catch (error) {
    console.error('Error initializing WebSocket:', error);
  }
}

// Re-initialize WebSocket when auth token changes
window.addEventListener('storage', (event) => {
  if (event.key === 'user') {
    const newValue = event.newValue ? JSON.parse(event.newValue) : null;
    if (newValue && newValue.token) {
      initializeWebSocket();
    } else if (ws) {
      ws.close();
      ws = null;
    }
  }
});

// Initialize WebSocket on import if user exists
if (browserAuth.getUser()) {
  initializeWebSocket();
}

// Logout user
export const logoutUser = async (userId, token, jti) => {
  try {
    // Get token expiration from JWT
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      throw new Error('Invalid token');
    }

    // Add token to blacklist
    await addToBlacklist(jti, decoded.exp, userId, token, 'LOGOUT');

    // Revoke all refresh tokens for the user
    await RefreshToken.updateMany(
      { user: userId, revokedAt: null },
      { revokedAt: new Date() }
    );

    return true;
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// Change password
export const changePassword = async (userId, oldPassword, newPassword) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Blacklist all existing tokens for security
    await blacklistAllUserTokens(userId, 'PASSWORD_CHANGE');

    // Generate new token
    const { token, jti } = generateToken(user);
    const refreshToken = await RefreshToken.generateRefreshToken(user._id);

    return {
      token,
      refreshToken: refreshToken.token
    };
  } catch (error) {
    console.error('Password change error:', error);
    throw error;
  }
};