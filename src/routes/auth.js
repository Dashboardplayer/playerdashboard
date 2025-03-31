const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { auth } = require('../middleware/auth');
const { validatePassword } = require('../utils/passwordValidation');
const { get2FAStatus, verifyTOTP } = require('../services/twoFactorService');

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check 2FA status
    const twoFAStatus = await get2FAStatus(user._id);
    
    // Generate tokens
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const refreshToken = await RefreshToken.generateRefreshToken(user._id);

    // Return response based on 2FA status
    if (twoFAStatus.enabled) {
      return res.json({
        requiresTwoFactor: true,
        tempToken: token
      });
    }

    res.json({
      token,
      refreshToken: refreshToken.token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
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