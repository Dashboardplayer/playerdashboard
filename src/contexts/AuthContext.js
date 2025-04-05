import React, { createContext, useContext, useState, useEffect } from 'react';
import { browserAuth } from '../utils/browserUtils';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for user in localStorage on mount
    const storedUser = browserAuth.getUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
    
    // Listen for storage events to sync auth state across tabs
    const handleStorageChange = (event) => {
      if (event.key === 'user') {
        const newUser = event.newValue ? JSON.parse(event.newValue) : null;
        setUser(newUser);
      } else if (event.key === 'accessToken' && !event.newValue) {
        // If token is removed, clear user
        setUser(null);
      }
    };
    
    // Listen for custom auth events
    const handleAuthEvent = () => {
      const storedUser = browserAuth.getUser();
      setUser(storedUser);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth_logout', () => setUser(null));
    window.addEventListener('auth_update', handleAuthEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth_logout', () => setUser(null));
      window.removeEventListener('auth_update', handleAuthEvent);
    };
  }, []);

  const login = (userData) => {
    // Just update the React state - the actual storage is managed by browserAuth.setAuth
    setUser(userData);
    // Dispatch event to ensure synchronization
    window.dispatchEvent(new Event('auth_update'));
  };

  const logout = () => {
    // Clear from localStorage
    browserAuth.clearAuth();
    // Update React state
    setUser(null);
    // Dispatch event to ensure synchronization
    window.dispatchEvent(new Event('auth_logout'));
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'superadmin'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 