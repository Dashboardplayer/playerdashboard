import { useState, useEffect } from 'react';
import { mongoClient } from './mongoClient';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        // Get the current user from MongoDB profiles collection
        // This assumes you have some way to identify the current user (e.g., through session)
        const { data, error } = await mongoClient.from('profiles').select('*').single();

        if (error) {
          console.error('Error fetching user:', error);
          setError(error);
          return;
        }

        if (data) {
          setUser(data);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
  };
} 