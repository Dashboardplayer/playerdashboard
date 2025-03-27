import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import User from '../models/User.js';

// Generate a new TOTP secret for a user
export const generateTOTPSecret = async (userId) => {
  try {
    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorTempSecret');
    if (!user) {
      return { error: 'User not found' };
    }

    // Generate new secret
    const secret = speakeasy.generateSecret({
      name: `Player Dashboard (${user.email})`
    });

    // Store temporary secret
    user.twoFactorTempSecret = secret.base32;
    user.twoFactorPendingSetup = true;
    await user.save();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl
    };
  } catch (error) {
    console.error('Error generating TOTP secret:', error);
    return { error: error.message };
  }
};

// Verify TOTP token during setup
export const verifyTOTPSetup = async (userId, token) => {
  try {
    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorTempSecret');
    if (!user) {
      return { error: 'User not found' };
    }

    if (!user.twoFactorTempSecret) {
      return { error: 'No pending 2FA setup found' };
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorTempSecret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 30 seconds window
    });

    if (!verified) {
      return { error: 'Invalid verification code' };
    }

    // Setup successful, move temp secret to permanent
    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorEnabled = true;
    user.twoFactorPendingSetup = false;
    user.twoFactorTempSecret = undefined;
    await user.save();

    return { success: true };
  } catch (error) {
    console.error('Error verifying TOTP setup:', error);
    return { error: error.message };
  }
};

// Verify TOTP token for login
export const verifyTOTP = async (userId, token) => {
  try {
    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user) {
      return { error: 'User not found' };
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return { error: '2FA is not enabled for this user' };
    }

    // Clean up the token (remove spaces and non-numeric characters)
    const cleanToken = token.replace(/\D/g, '');

    // Verify with a larger window to account for time drift
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: cleanToken,
      window: 2 // Allow 1 minute window (30 seconds before and after)
    });

    if (!verified) {
      console.log('TOTP verification failed for user:', userId);
      console.log('Received token:', cleanToken);
      return { error: 'Invalid verification code' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    return { error: error.message };
  }
};

// Disable 2FA for a user
export const disable2FA = async (userId, token) => {
  try {
    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user) {
      return { error: 'User not found' };
    }

    if (!user.twoFactorEnabled) {
      return { error: '2FA is not enabled for this user' };
    }

    // Verify the token before disabling
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (!verified) {
      return { error: 'Invalid verification code' };
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    return { success: true };
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return { error: error.message };
  }
};

// Get 2FA status for a user
export const get2FAStatus = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { error: 'User not found' };
    }

    return {
      enabled: user.twoFactorEnabled,
      pendingSetup: user.twoFactorPendingSetup
    };
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    return { error: error.message };
  }
}; 