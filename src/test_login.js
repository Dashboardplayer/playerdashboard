// Simple login test file
// This can help debug login issues without affecting the main application

import { browserAuth } from './utils/browserUtils.js';
import { authAPI } from './hooks/apiClient.js';

// Simple utility to test the login flow
const testLogin = async (email, password) => {
  console.log('Testing login with:', email);
  
  try {
    const result = await authAPI.login({ email, password });
    
    console.log('Login result:', {
      success: !result.error,
      hasToken: !!result.data?.token,
      hasRefreshToken: !!result.data?.refreshToken,
      hasUser: !!result.data?.user,
      error: result.error
    });
    
    // If successful, test the browserAuth
    if (result.data?.token && result.data?.user) {
      console.log('Setting auth data...');
      browserAuth.setAuth(
        result.data.token, 
        result.data.refreshToken, 
        result.data.user
      );
      
      // Test reading back the authentication state
      const user = browserAuth.getUser();
      console.log('Retrieved user from storage:', !!user);
      
      if (user) {
        console.log('User ID:', user.id);
        console.log('User role:', user.role);
        console.log('Token present:', !!user.token);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Test login error:', error);
    return { error: error.message };
  }
};

// Expose for use in console
window.testLogin = testLogin;
window.browserAuth = browserAuth;

export { testLogin }; 