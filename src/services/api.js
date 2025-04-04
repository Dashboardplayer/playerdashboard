import axios from 'axios';

// Get the API version to use, defaulting to v1
const API_VERSION = process.env.REACT_APP_API_VERSION || 'v1';

// Helper function to sign sensitive requests
const signRequest = async (payload) => {
  try {
    // Get the current user from local storage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!user.id) {
      console.error('Cannot sign request: User not authenticated');
      return {};
    }
    
    // Generate a timestamp
    const timestamp = Date.now();
    
    // Sign the request using the API
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/${API_VERSION}/auth/sign-request`,
      { payload, userId: user.id, timestamp },
      { headers: { Authorization: `Bearer ${user.token}` } }
    );
    
    return {
      signature: response.data.signature,
      timestamp
    };
  } catch (error) {
    console.error('Failed to sign request:', error);
    return {};
  }
};

const apiClient = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/${API_VERSION}`,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Version': API_VERSION
  }
});

// Add auth token to requests
apiClient.interceptors.request.use(async config => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  
  // For sensitive operations, add request signing
  const sensitiveEndpoints = [
    '/auth/change-password',
    '/auth/update-profile',
    '/auth/enable-2fa',
    '/auth/disable-2fa',
    '/auth/verify-2fa'
  ];
  
  // Check if this is a sensitive operation that needs signing
  const isSensitiveEndpoint = sensitiveEndpoints.some(endpoint => 
    config.url.includes(endpoint)
  );
  
  if (isSensitiveEndpoint && (config.method === 'post' || config.method === 'put')) {
    const { signature, timestamp } = await signRequest(config.data);
    
    if (signature && timestamp) {
      config.headers['X-Signature'] = signature;
      config.headers['X-Timestamp'] = timestamp;
    }
  }
  
  return config;
});

// Add response handler to detect API version issues
apiClient.interceptors.response.use(
  (response) => {
    // Check if API server version matches our expected version
    const serverVersion = response.headers['x-api-version'];
    
    // If server reports a version mismatch, log it but don't fail the request
    if (serverVersion && serverVersion !== API_VERSION) {
      console.warn(`API version mismatch: expected ${API_VERSION}, got ${serverVersion}`);
    }
    
    return response;
  },
  (error) => {
    // Pass through normal errors
    return Promise.reject(error);
  }
);

// Auth API
export const auth = {
  login: (email, password) => 
    apiClient.post('/auth/login', { email, password }),
  
  register: (email, password, role, company_id) =>
    apiClient.post('/auth/register', { email, password, role, company_id }),
  
  resetPassword: (email) =>
    apiClient.post('/auth/forgot-password', { email }),
  
  verifyToken: () =>
    apiClient.get('/auth/verify'),
  
  refreshToken: () =>
    apiClient.post('/auth/refresh-token'),
    
  changePassword: (oldPassword, newPassword) =>
    apiClient.post('/auth/change-password', { oldPassword, newPassword }),
    
  enable2FA: () =>
    apiClient.post('/auth/enable-2fa'),
    
  verify2FA: (token) =>
    apiClient.post('/auth/verify-2fa', { token }),
    
  disable2FA: () =>
    apiClient.post('/auth/disable-2fa')
};

// Users API
export const users = {
  getCurrent: () => 
    apiClient.get('/users/me'),
  
  getById: (id) =>
    apiClient.get(`/users/${id}`),
  
  update: (id, data) =>
    apiClient.put(`/users/${id}`, data),
  
  delete: (id) =>
    apiClient.delete(`/users/${id}`)
};

// Companies API
export const companies = {
  getAll: () =>
    apiClient.get('/companies'),
  
  getById: (id) =>
    apiClient.get(`/companies/${id}`),
  
  create: (data) =>
    apiClient.post('/companies', data),
  
  update: (id, data) =>
    apiClient.put(`/companies/${id}`, data),
  
  delete: (id) =>
    apiClient.delete(`/companies/${id}`)
};

// Players API
export const players = {
  getAll: () =>
    apiClient.get('/players'),
  
  getById: (id) =>
    apiClient.get(`/players/${id}`),
  
  create: (data) =>
    apiClient.post('/players', data),
  
  update: (id, data) =>
    apiClient.put(`/players/${id}`, data),
  
  delete: (id) =>
    apiClient.delete(`/players/${id}`)
};

// Function to switch API versions
export const switchApiVersion = (newVersion) => {
  // Update axios client baseURL
  apiClient.defaults.baseURL = `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/${newVersion}`;
  apiClient.defaults.headers['X-API-Version'] = newVersion;
  
  // Store the setting for persistence
  localStorage.setItem('api_version', newVersion);
  
  return { version: newVersion };
};

// Initialize API version from localStorage if available
const initializeApiVersion = () => {
  const savedVersion = localStorage.getItem('api_version');
  if (savedVersion) {
    switchApiVersion(savedVersion);
  }
};

// Call initialization on import
initializeApiVersion();

export default apiClient; 