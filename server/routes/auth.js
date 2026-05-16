const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const User = require('../../src/models/User');
const Company = require('../../src/models/Company');
const RefreshToken = require('../../src/models/RefreshToken');
const { auth, authorize } = require('../../src/middleware/auth');
const { validatePassword } = require('../../src/utils/passwordValidation');
const { secureLog } = require('../../src/utils/secureLogger');
const { sendPasswordResetEmail, sendRegistrationInvitationEmail } = require('../../src/services/emailService');
const { addToBlacklist } = require('../../src/services/tokenBlacklistService');
const {
  generateTOTPSecret,
  verifyTOTPSetup,
  verifyTOTP,
  disable2FA,
  get2FAStatus
} = require('../../src/services/twoFactorService');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Te veel inlogpogingen. Probeer het later opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false
});

const maskEmail = (email) => {
  if (!email) return 'unknown';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  return `${local.substring(0, 2)}***@${domain}`;
};

const sanitizeAuthUser = (user) => ({
  id: user._id,
  email: user.email,
  role: user.role,
  company_id: user.company_id,
  isActive: user.isActive,
  twoFactorEnabled: Boolean(user.twoFactorEnabled),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  path: '/'
};

const setAuthCookies = (res, token, refreshToken) => {
  res.cookie('access_token', token, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000
  });
  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);
};

const getCookieValue = (req, name) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;

  return decodeURIComponent(match.substring(name.length + 1));
};

const generateToken = (user) => {
  if (!user || !user._id || !user.email || !user.role) {
    throw new Error('Invalid user data for token generation');
  }

  const jti = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    {
      jti,
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      company_id: user.company_id
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m',
      algorithm: 'HS256',
      audience: 'player-dashboard-api',
      issuer: 'player-dashboard'
    }
  );

  return { token, jti };
};

const verifyRecaptcha = async (token) => {
  if (process.env.NODE_ENV === 'development' && process.env.RECAPTCHA_DEV_BYPASS !== 'false') {
    return true;
  }

  if (!process.env.RECAPTCHA_SECRET_KEY) {
    return true;
  }

  try {
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token
      }
    });
    return response.data.success;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
};

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password, recaptchaToken } = req.body;
    console.log('Login attempt received:', { email: maskEmail(email) });
    const bypassRecaptcha = process.env.NODE_ENV === 'development' && process.env.RECAPTCHA_DEV_BYPASS !== 'false';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      isActive: true
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if ((user.loginAttempts || 0) >= 3 && !bypassRecaptcha) {
      if (!recaptchaToken) {
        return res.status(400).json({ error: 'CAPTCHA verification required' });
      }

      const isValidCaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidCaptcha) {
        return res.status(400).json({ error: 'Invalid CAPTCHA' });
      }
    }

    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      await user.save();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    user.loginAttempts = 0;
    await user.save();

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
      return res.json({ requires2FA: true, tempToken });
    }

    const { token } = generateToken(user);
    const refreshToken = await RefreshToken.generateRefreshToken(user._id);

    console.log('Login successful:', { userId: user._id, email: maskEmail(user.email) });
    setAuthCookies(res, token, refreshToken.plainToken);

    return res.json({
      token,
      refreshToken: refreshToken.plainToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || getCookieValue(req, 'refresh_token');

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const savedToken = await RefreshToken.findByToken(refreshToken);
    if (!savedToken || !savedToken.isActive()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(savedToken.user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { token } = generateToken(user);
    const newRefreshToken = await RefreshToken.generateRefreshToken(user._id);

    savedToken.revokedAt = new Date();
    savedToken.replacedByToken = RefreshToken.hashToken(newRefreshToken.plainToken);
    await savedToken.save();
    setAuthCookies(res, token, newRefreshToken.plainToken);

    return res.json({
      token,
      refreshToken: newRefreshToken.plainToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/check-session', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: sanitizeAuthUser(user) });
  } catch (error) {
    console.error('Session check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', auth, async (req, res) => {
  try {
    const exp = Math.floor(Date.now() / 1000) + (15 * 60);
    if (req.user.jti) {
      await addToBlacklist(req.user.jti, exp, req.user.id, req.token, 'LOGOUT');
    }

    const refreshToken = req.body.refreshToken || getCookieValue(req, 'refresh_token');
    if (refreshToken) {
      await RefreshToken.revokeToken(refreshToken);
    }
    clearAuthCookies(res);

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, registrationToken } = req.body;

    if (!email || !password || !registrationToken) {
      return res.status(400).json({ error: 'Email, password, and registration token are required' });
    }

    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        passwordErrors: errors
      });
    }

    const user = await User.findOne({
      registrationToken,
      registrationTokenExpires: { $gt: Date.now() },
      isActive: false
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired registration token' });
    }

    if (email !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase(), isActive: true });
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
      user.email = email.toLowerCase();
    }

    await user.setPassword(password);
    user.isActive = true;
    user.registrationToken = undefined;
    user.registrationTokenExpires = undefined;
    await user.save();

    const { token } = generateToken(user);

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        field: 'email',
        message: 'Voer een e-mailadres in'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        field: 'email',
        message: 'Voer een geldig e-mailadres in'
      });
    }

    const normalizedEmail = email.toLowerCase();
    console.log(`Processing password reset for email: ${maskEmail(normalizedEmail)}`);

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.json({
        success: true,
        message: 'Als er een account bestaat met dit e-mailadres, ontvang je binnen enkele minuten een e-mail met instructies om je wachtwoord te resetten.'
      });
    }

    const cooldownPeriod = 5 * 60 * 1000;
    if (user.resetPasswordExpires && user.resetPasswordExpires.getTime() - Date.now() > (60 * 60 * 1000 - cooldownPeriod)) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Er is recent al een reset link verzonden. Wacht enkele minuten voordat je het opnieuw probeert.',
        retryAfter: Math.ceil((user.resetPasswordExpires.getTime() - Date.now() - (60 * 60 * 1000 - cooldownPeriod)) / 1000)
      });
    }

    const resetToken = user.generateResetToken();
    await user.save();

    const emailResult = await sendPasswordResetEmail(normalizedEmail, resetToken);
    if (!emailResult.success) {
      return res.status(500).json({
        error: 'Failed to send email',
        message: 'Er is een probleem opgetreden bij het verzenden van de e-mail. Probeer het later opnieuw.'
      });
    }

    return res.json({
      success: true,
      message: 'Er is een e-mail verzonden met instructies om je wachtwoord te resetten.',
      ...(process.env.NODE_ENV === 'development' ? { resetToken } : {})
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.'
    });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token: resetToken, password } = req.body;

    if (!resetToken || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        passwordErrors: errors
      });
    }

    await user.setPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.isActive = true;
    user.status = 'active';
    await user.save();

    const { token } = generateToken(user);

    return res.json({
      message: 'Password has been reset successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      token
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register-invitation', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const { email, role, company_id } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
      $or: [{ isActive: true }, { status: 'active' }]
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Deze gebruiker is al geregistreerd. Er kan geen nieuwe uitnodiging worden verzonden.'
      });
    }

    if (req.user.role === 'bedrijfsadmin') {
      if (role !== 'user' && role !== 'bedrijfsadmin') {
        return res.status(403).json({ error: 'Bedrijfsadmins can only create regular users and bedrijfsadmins' });
      }

      const effectiveCompanyId = company_id || req.user.company_id;
      if (effectiveCompanyId !== req.user.company_id) {
        return res.status(403).json({ error: 'Cannot create users for other companies' });
      }

      const companyUsers = await User.find({ company_id: req.user.company_id });
      if (companyUsers.length >= 5) {
        return res.status(403).json({ error: 'Maximum number of users reached for this company' });
      }
    }

    let user = await User.findOne({
      email: normalizedEmail,
      status: 'pending'
    });

    if (user) {
      const lastInviteTime = user.lastReminderSent || user.createdAt;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastInviteTime && lastInviteTime > oneHourAgo) {
        const minutesLeft = Math.ceil((lastInviteTime.getTime() + 60 * 60 * 1000 - Date.now()) / (60 * 1000));
        return res.status(429).json({
          error: `Er is recent een uitnodiging verzonden. Wacht nog ${minutesLeft} minuten voordat je een nieuwe uitnodiging verstuurt.`
        });
      }

      user.role = role;
      user.company_id = company_id || req.user.company_id;
      user.lastReminderSent = new Date();
    } else {
      user = new User({
        email: normalizedEmail,
        role,
        company_id: company_id || req.user.company_id,
        status: 'pending',
        lastReminderSent: new Date()
      });
    }

    const registrationToken = user.generateRegistrationToken();
    await user.save();

    let companyName = '';
    if (user.company_id) {
      const company = await Company.findOne({ company_id: user.company_id });
      if (company) {
        companyName = company.company_name;
      }
    }

    const emailResult = await sendRegistrationInvitationEmail(
      normalizedEmail,
      registrationToken,
      role,
      companyName
    );

    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to send invitation email' });
    }

    return res.json({
      message: 'Invitation sent successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Registration invitation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/complete-registration', async (req, res) => {
  try {
    const { token: registrationToken, password, email } = req.body;

    if (!registrationToken) {
      return res.status(400).json({ error: 'Registration token is required' });
    }

    const user = await User.findOne({
      registrationToken,
      registrationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired registration token' });
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, isActive: true });
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already in use by another user' });
      }
      user.email = email;
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        passwordErrors: errors
      });
    }

    await user.setPassword(password);
    await user.save();

    const { token } = generateToken(user);

    return res.json({
      message: 'Registration completed successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      token
    });
  } catch (error) {
    console.error('Registration completion error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/resend-invitation/:userId', auth, authorize(['superadmin']), async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isActive) {
      return res.status(400).json({ error: 'User is already active' });
    }

    let companyName = '';
    if (user.company_id) {
      const company = await Company.findOne({ company_id: user.company_id });
      if (company) {
        companyName = company.company_name;
      }
    }

    const registrationToken = user.generateRegistrationToken();
    user.lastReminderSent = new Date();
    await user.save();

    const emailResult = await sendRegistrationInvitationEmail(
      user.email,
      registrationToken,
      user.role,
      companyName
    );

    if (!emailResult.success) {
      return res.status(500).json({
        error: 'Failed to send invitation reminder',
        message: 'Er is een probleem opgetreden bij het verzenden van de herinnering. Probeer het later opnieuw.'
      });
    }

    return res.json({
      success: true,
      message: 'Herinnering is verzonden.'
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/verify-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const user = await User.findOne({
      registrationToken: token,
      registrationTokenExpires: { $gt: Date.now() },
      isActive: false
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired registration token' });
    }

    let company_name = '';
    if (user.company_id) {
      const company = await Company.findOne({ company_id: user.company_id });
      if (company) {
        company_name = company.company_name;
      }
    }

    return res.json({
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      company_name
    });
  } catch (error) {
    secureLog.error('Token verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/2fa/generate', auth, async (req, res) => {
  try {
    const result = await generateTOTPSecret(req.user.id);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error generating 2FA secret:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/2fa/verify-setup', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const result = await verifyTOTPSetup(req.user.id, token);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error verifying 2FA setup:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/2fa/verify', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const result = await verifyTOTP(req.user.id, token);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/2fa/disable', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const result = await disable2FA(req.user.id, token);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/2fa/status', auth, async (req, res) => {
  try {
    const result = await get2FAStatus(req.user.id);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/2fa/verify-login', async (req, res) => {
  try {
    const { token: verificationCode, tempToken } = req.body;

    if (!verificationCode || !tempToken) {
      return res.status(400).json({ error: 'Verification code and temporary token are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (!decoded.requires2FA) {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const twoFAStatus = await get2FAStatus(user._id);
    if (!twoFAStatus.enabled) {
      return res.status(400).json({ error: '2FA is not enabled for this user' });
    }

    const result = await verifyTOTP(decoded.id, verificationCode);
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }

    const { token } = generateToken(user);
    const refreshToken = await RefreshToken.generateRefreshToken(user._id);
    setAuthCookies(res, token, refreshToken.plainToken);

    return res.json({
      token,
      refreshToken: refreshToken.plainToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
