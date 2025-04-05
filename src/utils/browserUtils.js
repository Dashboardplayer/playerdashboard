// Browser-specific utilities to replace Node.js functionality

// Browser-compatible authentication utilities
export const browserAuth = {
  // Store auth data (tokens and user info) in local storage
  setAuth: (accessToken, refreshToken, user) => {
    if (typeof window !== 'undefined') {
      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      
      // If the second parameter is an object and no third parameter, it's the user (backward compatibility)
      let userData;
      if (typeof refreshToken === 'object' && !user) {
        userData = {
          ...refreshToken,
          token: accessToken // Keep token in user object for backward compatibility
        };
        // For backward compatibility, don't store refreshToken in this case
      } else {
        // Store refresh token if provided as string
        if (refreshToken && typeof refreshToken === 'string') {
          localStorage.setItem('refreshToken', refreshToken);
        }
        
        // User data comes from third parameter
        userData = {
          ...user,
          token: accessToken // Keep token in user object for backward compatibility
        };
      }
      
      // First update local storage
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Then trigger a storage event for cross-tab communication
      // This fixes an issue where the dashboard crashes on first login
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'user',
        newValue: JSON.stringify(userData)
      }));
    }
  },
  
  // Clear auth data from local storage
  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // Dispatch a storage event to notify other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'user',
        oldValue: localStorage.getItem('user'),
        newValue: null
      }));
    }
  },
  
  // Get user from local storage
  getUser: () => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');
      try {
        const user = userStr ? JSON.parse(userStr) : null;
        if (user && accessToken) {
          user.token = accessToken; // Ensure token is current
          return user;
        }
        return null;
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  },
  
  // Check if user is authenticated
  isAuthenticated: () => {
    if (typeof window !== 'undefined') {
      const accessToken = localStorage.getItem('accessToken');
      const user = browserAuth.getUser();
      return !!(user && accessToken);
    }
    return false;
  },

  // Get tokens
  getTokens: () => {
    if (typeof window !== 'undefined') {
      return {
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken')
      };
    }
    return { accessToken: null, refreshToken: null };
  },

  // Get current token (for backward compatibility)
  getToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }
    return null;
  }
};

// Empty module exports to be used as shims
export const emptyModule = {
  sign: () => 'mock-token',
  verify: () => ({ id: 'mock-id' }),
  decode: () => ({ payload: {} })
};