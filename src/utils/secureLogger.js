// Utility to mask sensitive data in logs while preserving debugging information
const SENSITIVE_FIELDS = {
  // Authentication
  token: true,
  refreshToken: true,
  tempToken: true,
  registrationToken: true,
  resetPasswordToken: true,
  'headers.authorization': true,
  'headers.Authorization': true,
  jwt: true,

  // Personal Information
  email: true,
  password: true,
  contact_phone: true,

  // IDs and Keys
  _id: true,
  company_id: true,
  device_id: true,
  jti: true,

  // Role Information
  role: true,

  // API Keys and Secrets
  apiKey: true,
  apiSecret: true,
  MAILJET_API_KEY: true,
  MAILJET_SECRET_KEY: true,
  JWT_SECRET: true
};

// Fields that should be completely removed rather than masked
const REMOVE_FIELDS = ['password', 'apiSecret', 'JWT_SECRET'];

// Function to check if we're in development environment
const isDevelopment = () => {
  return process.env.NODE_ENV === 'development';
};

// Function to mask a string value
const maskValue = (value, type = 'default') => {
  if (typeof value !== 'string' || !value) return '[empty]';
  
  switch (type) {
    case 'email':
      const [local, domain] = value.split('@');
      if (!domain) return '***@***';
      return `${local.charAt(0)}***@${domain}`;
    
    case 'token':
      return value.length > 8 ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : '***';
    
    case 'id':
      return value.length > 4 ? `${value.substring(0, 2)}...${value.substring(value.length - 2)}` : '***';
    
    default:
      return '***';
  }
};

// Function to determine masking type based on field name
const getMaskType = (field) => {
  if (field.includes('email')) return 'email';
  if (field.includes('token') || field.includes('Token')) return 'token';
  if (field.includes('id') || field.includes('Id') || field === '_id') return 'id';
  return 'default';
};

// Main function to mask sensitive data in objects
const maskSensitiveData = (data) => {
  // Return early if not an object
  if (!data || typeof data !== 'object') return data;

  // Don't mask in development unless forced
  if (isDevelopment() && !process.env.FORCE_MASK_LOGS) return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  // Create a copy to avoid modifying the original
  const maskedData = { ...data };

  // Recursively mask sensitive fields
  for (const [key, value] of Object.entries(maskedData)) {
    const lowerKey = key.toLowerCase();

    // Remove sensitive fields that should never be logged
    if (REMOVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      delete maskedData[key];
      continue;
    }

    // Mask sensitive fields
    if (SENSITIVE_FIELDS[key] || Object.keys(SENSITIVE_FIELDS).some(field => 
      lowerKey.includes(field.toLowerCase())
    )) {
      if (value && typeof value === 'string') {
        maskedData[key] = maskValue(value, getMaskType(key));
      } else if (value && typeof value === 'object') {
        maskedData[key] = maskSensitiveData(value);
      }
    } else if (value && typeof value === 'object') {
      maskedData[key] = maskSensitiveData(value);
    }
  }

  return maskedData;
};

// Secure console logging functions
const secureLog = {
  log: (...args) => {
    console.log(...args.map(arg => 
      typeof arg === 'object' ? maskSensitiveData(arg) : arg
    ));
  },

  error: (...args) => {
    console.error(...args.map(arg => 
      typeof arg === 'object' ? maskSensitiveData(arg) : arg
    ));
  },

  info: (...args) => {
    console.info(...args.map(arg => 
      typeof arg === 'object' ? maskSensitiveData(arg) : arg
    ));
  },

  debug: (...args) => {
    console.debug(...args.map(arg => 
      typeof arg === 'object' ? maskSensitiveData(arg) : arg
    ));
  },

  warn: (...args) => {
    console.warn(...args.map(arg => 
      typeof arg === 'object' ? maskSensitiveData(arg) : arg
    ));
  }
};

module.exports = {
  secureLog,
  maskSensitiveData
}; 