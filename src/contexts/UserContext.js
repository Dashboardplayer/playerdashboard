import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../hooks/apiClient.js';

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check initial auth state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: userData, error: userError } = await authAPI.getCurrentUser();
        if (userData?.user) {
          setProfile(userData.user);
        } else if (userError) {
          setError('Authenticatie mislukt. Probeer opnieuw in te loggen.');
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setError('Er is een fout opgetreden. Probeer het later opnieuw.');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Function to update user profile (would need to be implemented in API)
  const updateProfile = async (updates) => {
    if (!profile || !profile.id) {
      setError('Geen gebruikersprofiel gevonden om te updaten.');
      return { error: 'No profile found' };
    }
    
    try {
      // This would need a proper endpoint in the server.js API
      // For now, we'll just update locally
      const updatedProfile = {...profile, ...updates};
      setProfile(updatedProfile);
      return { data: updatedProfile };
      
      // In a real implementation, you would do:
      // const { data, error: updateError } = await userAPI.updateProfile(profile.id, updates);
    } catch (err) {
      console.error('Unexpected error during profile update:', err);
      setError('Er is een onverwachte fout opgetreden.');
      return { error: err };
    }
  };

  // Function to handle logout
  const logout = async () => {
    try {
      const { error } = await authAPI.logout();
      
      if (error) {
        setError(`Fout bij uitloggen: ${error}`);
        return { error };
      }
      
      setProfile(null);
      return { success: true };
    } catch (err) {
      console.error('Unexpected error during logout:', err);
      setError('Er is een onverwachte fout opgetreden.');
      return { error: err };
    }
  };

  const value = {
    profile,
    setProfile,
    loading,
    error,
    updateProfile,
    logout
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
