const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { auth } = require('../middleware/auth');
const { validatePassword } = require('../utils/passwordValidation');
const { get2FAStatus, verifyTOTP } = require('../services/twoFactorService');
const { secureLog } = require('../utils/secureLogger');

// Login route
router.post('/login', async (req, res) => {
  try {
    secureLog.info('Login attempt received');
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      secureLog.warn('Missing credentials');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isActive: true
    });

    if (!user) {
      secureLog.warn('Invalid login attempt - user not found');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      secureLog.warn('Invalid login attempt - incorrect password');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if 2FA is enabled
    const twoFAStatus = await get2FAStatus(user._id);
    if (twoFAStatus.enabled) {
      const tempToken = jwt.sign(
        { 
          id: user._id, 
          requires2FA: true,
          email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      secureLog.info('2FA required for login', { userId: user._id });
      return res.json({ requires2FA: true, tempToken });
    }

    // Generate access token
    const { token, jti } = generateToken(user);
    
    // Generate refresh token
    const refreshToken = await RefreshToken.generateRefreshToken(user._id);

    secureLog.info('Login successful', { userId: user._id });
    
    res.json({
      token: token,
      refreshToken: refreshToken.token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    secureLog.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register route
router.post('/register', async (req, res) => {
  try {
    const { email, password, registrationToken } = req.body;

    // Input validation
    if (!email || !password || !registrationToken) {
      secureLog.warn('Missing registration data');
      return res.status(400).json({ error: 'Email, password, and registration token are required' });
    }

    // Validate password strength
    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      secureLog.warn('Invalid password format during registration');
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        passwordErrors: errors
      });
    }

    // Find user with valid registration token
    const user = await User.findOne({
      registrationToken,
      registrationTokenExpires: { $gt: Date.now() },
      isActive: false
    });

    if (!user) {
      secureLog.warn('Invalid or expired registration token used');
      return res.status(400).json({ error: 'Invalid or expired registration token' });
    }

    // Update email if different from invitation
    if (email !== user.email) {
      // Check if new email is already in use
      const existingUser = await User.findOne({ email: email.toLowerCase(), isActive: true });
      if (existingUser) {
        secureLog.warn('Registration attempted with existing email');
        return res.status(400).json({ error: 'Email is already in use' });
      }
      user.email = email.toLowerCase();
    }

    // Set password and activate account
    await user.setPassword(password);
    user.isActive = true;
    user.registrationToken = undefined;
    user.registrationTokenExpires = undefined;
    
    await user.save();
    
    secureLog.info('User registration completed', { userId: user._id });

    // Generate JWT token
    const { token } = generateToken(user);

    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      token
    });
  } catch (error) {
    secureLog.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify registration token
router.get('/verify-token', async (req, res) => {
  try {
    const { token } = req.query;
    secureLog.info('Verify token request received');

    if (!token) {
      secureLog.warn('No token provided in verify-token request');
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find user with valid registration token
    const user = await User.findOne({
      registrationToken: token,
      registrationTokenExpires: { $gt: Date.now() },
      isActive: false
    });

    if (!user) {
      secureLog.warn('Invalid or expired token verification attempt');
      return res.status(400).json({ error: 'Invalid or expired registration token' });
    }

    secureLog.info('Token verification successful', { userId: user._id });

    // Get company name if company_id exists
    let company_name = '';
    if (user.company_id) {
      const company = await Company.findOne({ company_id: user.company_id });
      if (company) {
        company_name = company.company_name;
      }
    }

    // Return user info without sensitive data
    return res.json({
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      company_name
    });
  } catch (error) {
    secureLog.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token route
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const existingToken = await RefreshToken.findOne({ token: refreshToken });
    if (!existingToken || !existingToken.isValid) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await User.findById(existingToken.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify 2FA token
router.post('/verify-2fa', async (req, res) => {
  try {
    const { token, verificationCode } = req.body;
    
    if (!token || !verificationCode) {
      return res.status(400).json({ error: 'Token and verification code are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await verifyTOTP(decoded.id, verificationCode);
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }

    const newToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const refreshToken = await RefreshToken.generateRefreshToken(user._id);

    res.json({
      token: newToken,
      refreshToken: refreshToken.token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout route
router.post('/logout', auth, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.findOneAndDelete({ token: refreshToken });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 