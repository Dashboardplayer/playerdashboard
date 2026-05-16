const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../../src/models/User');
const { auth, authorize } = require('../../src/middleware/auth');
const { validatePassword } = require('../../src/utils/passwordValidation');

const maskEmail = (email) => {
  if (!email) return 'unknown';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  return `${local.substring(0, 2)}***@${domain}`;
};

const sanitizeUser = (user) => {
  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.registrationToken;
  delete obj.registrationTokenExpires;
  delete obj.twoFactorSecret;
  delete obj.twoFactorTempSecret;
  return obj;
};

// Keep this before /:id.
router.get('/test', auth, (req, res) => {
  res.json({ message: 'Test route working' });
});

router.post('/update-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await user.verifyPassword(currentPassword);
    if (!isValidPassword) {
      console.log('Invalid current password for user:', maskEmail(user.email));
      return res.status(401).json({ error: 'Huidig wachtwoord is incorrect' });
    }

    const { isValid, errors } = validatePassword(newPassword);
    if (!isValid) {
      return res.status(400).json({
        error: 'Password does not meet security requirements',
        passwordErrors: errors
      });
    }

    await user.setPassword(newPassword);
    await user.save();

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const query = {};

    if (req.user.role !== 'superadmin') {
      if (!req.user.company_id) {
        return res.json([]);
      }
      query.company_id = req.user.company_id;
    }

    const users = await User.find(query).sort({ email: 1 });
    return res.json(users.map(sanitizeUser));
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id format' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.role === 'user' && user._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to access this user' });
    }

    if (req.user.role === 'bedrijfsadmin' && user.company_id !== req.user.company_id && user._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to access this user' });
    }

    return res.json(sanitizeUser(user));
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const userData = { ...req.body };

    if (req.user.role !== 'superadmin') {
      userData.company_id = req.user.company_id;
      if (userData.role === 'superadmin') {
        return res.status(403).json({ error: 'Not authorized to create superadmins' });
      }
    }

    const user = new User(userData);
    await user.save();

    return res.status(201).json(sanitizeUser(user));
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user id format' });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.role === 'user' && targetUser._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this user' });
    }

    if (req.user.role !== 'superadmin') {
      if (req.user.role === 'bedrijfsadmin' && targetUser.company_id !== req.user.company_id && targetUser._id.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to update this user' });
      }
      if (updates.role && updates.role !== targetUser.role) {
        return res.status(403).json({ error: 'Not authorized to update role' });
      }
      if (updates.company_id && updates.company_id !== targetUser.company_id) {
        return res.status(403).json({ error: 'Not authorized to update company assignment' });
      }
    }

    delete updates.passwordHash;
    delete updates.resetPasswordToken;
    delete updates.resetPasswordExpires;
    delete updates.registrationToken;
    delete updates.registrationTokenExpires;
    delete updates.twoFactorSecret;
    delete updates.twoFactorTempSecret;
    delete updates.loginAttempts;
    delete updates.lockUntil;
    delete updates.lastLogin;

    if (req.user.role === 'user') {
      delete updates.role;
      delete updates.company_id;
      delete updates.isActive;
      delete updates.status;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true }
    );

    return res.json(sanitizeUser(user));
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', auth, authorize(['superadmin']), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id format' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'superadmin') {
      const superadminCount = await User.countDocuments({ role: 'superadmin' });
      if (superadminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last superadmin' });
      }
    }

    await User.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
