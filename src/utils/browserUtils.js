// Browser-specific utilities to replace Node.js functionality

// Browser-compatible authentication utilities
export const browserAuth = {
  // Store auth data (tokens and user info) in local storage
  setAuth: (accessToken, refreshToken, user) => {
    if (typeof window !== 'undefined') {
      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      
      // Store refresh token if provided
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      
      // If the second parameter is an object, it's the user (backward compatibility)
      let userData;
      if (typeof refreshToken === 'object' && !user) {
        userData = {
          ...refreshToken,
          token: accessToken // Keep token in user object for backward compatibility
        };
      } else {
        userData = {
          ...user,
          token: accessToken // Keep token in user object for backward compatibility
        };
      }
      
      localStorage.setItem('user', JSON.stringify(userData));
    }
  },
  
  // Clear auth data from local storage
  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
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