// Password validation rules
export const PASSWORD_RULES = {
  minLength: 8,
  minUppercase: 1,
  minLowercase: 1,
  minNumbers: 1,
  minSpecialChars: 1,
  maxLength: 128
};

// Special characters that are allowed in passwords
export const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/**
 * Validates a password against security requirements
 * @param {string} password - The password to validate
 * @returns {Object} - Validation result with success status and any error messages
 */
export const validatePassword = (password) => {
  const errors = [];

  if (!password) {
    return {
      isValid: false,
      errors: ['Wachtwoord is verplicht']
    };
  }

  // Check minimum length
  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Wachtwoord moet minimaal ${PASSWORD_RULES.minLength} karakters bevatten`);
  }

  // Check maximum length
  if (password.length > PASSWORD_RULES.maxLength) {
    errors.push(`Wachtwoord mag maximaal ${PASSWORD_RULES.maxLength} karakters bevatten`);
  }

  // Check for uppercase letters
  if ((password.match(/[A-Z]/g) || []).length < PASSWORD_RULES.minUppercase) {
    errors.push('Wachtwoord moet minimaal één hoofdletter bevatten');
  }

  // Check for lowercase letters
  if ((password.match(/[a-z]/g) || []).length < PASSWORD_RULES.minLowercase) {
    errors.push('Wachtwoord moet minimaal één kleine letter bevatten');
  }

  // Check for numbers
  if ((password.match(/[0-9]/g) || []).length < PASSWORD_RULES.minNumbers) {
    errors.push('Wachtwoord moet minimaal één cijfer bevatten');
  }

  // Check for special characters
  if ((password.match(new RegExp(`[${SPECIAL_CHARS.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`, 'g')) || []).length < PASSWORD_RULES.minSpecialChars) {
    errors.push('Wachtwoord moet minimaal één speciaal karakter bevatten (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generates a helper text message for password requirements
 * @returns {string} - Formatted helper text
 */
export const getPasswordHelperText = () => {
  return `Wachtwoord moet voldoen aan:
• Minimaal ${PASSWORD_RULES.minLength} karakters
• Minimaal één hoofdletter
• Minimaal één kleine letter
• Minimaal één cijfer
• Minimaal één speciaal karakter (!@#$%^&*()_+-=[]{}|;:,.<>?)`;
}; 