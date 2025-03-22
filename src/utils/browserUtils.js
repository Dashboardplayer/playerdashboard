// Browser-specific utilities to replace Node.js functionality

// Simple local storage based auth implementation
export const browserAuth = {
  // Store auth data (token, user info) in local storage
  setAuth: (token, user) => {
    if (!token || !user) return;
    localStorage.setItem('authToken', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  },
  
  // Clear auth data from local storage
  clearAuth: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('auth_user');
  },
  
  // Get token from local storage
  getToken: () => localStorage.getItem('authToken'),
  
  // Get user from local storage
  getUser: () => {
    try {
      const userData = localStorage.getItem('auth_user');
      return userData ? JSON.parse(userData) : null;
    } catch (e) {
      console.error('Error parsing user data:', e);
      return null;
    }
  },
  
  // Check if user is authenticated
  isAuthenticated: () => !!localStorage.getItem('authToken')
};

// Empty module exports to be used as shims
export const emptyModule = {
  sign: () => 'mock-token',
  verify: () => ({ id: 'mock-id' }),
  decode: () => ({ payload: {} })
};