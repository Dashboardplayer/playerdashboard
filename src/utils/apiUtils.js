import { debounce } from 'lodash';
import { browserAuth } from './browserUtils.js';

// Cache for storing API responses
const apiCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Helper function to get auth headers
const getAuthHeaders = () => {
  const user = browserAuth.getUser();
  if (!user || !user.token) {
    throw new Error('Authentication required');
  }
  return {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json'
  };
};

// Debounced fetch functions for different endpoints
export const debouncedFetch = {
  players: debounce((companyId) => fetchPlayers(companyId), 300),
  users: debounce((companyId) => fetchUsers(companyId), 300),
  companies: debounce(() => fetchCompanies(), 300)
};

// Function to check if cache is valid
const isCacheValid = (cacheEntry) => {
  return cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_DURATION;
};

// Function to get cached data or fetch new data
const getCachedOrFetch = async (cacheKey, fetchFn) => {
  const cachedData = apiCache.get(cacheKey);
  if (isCacheValid(cachedData)) {
    return cachedData.data;
  }

  const data = await fetchFn();
  apiCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  return data;
};

// Fetch functions with caching and authentication
export async function fetchPlayers(companyId) {
  const cacheKey = `players_${companyId || 'all'}`;
  const fetchFn = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/players${companyId ? `?company_id=${companyId}` : ''}`, {
        headers
      });
      
      if (response.status === 401) {
        browserAuth.clearAuth();
        window.location.href = '/login';
        throw new Error('Authentication required');
      }
      
      if (!response.ok) throw new Error('Failed to fetch players');
      return response.json();
    } catch (error) {
      console.error('Error fetching players:', error);
      throw error;
    }
  };
  return getCachedOrFetch(cacheKey, fetchFn);
}

export async function fetchUsers(companyId) {
  const cacheKey = `users_${companyId || 'all'}`;
  const fetchFn = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/users${companyId ? `?company_id=${companyId}` : ''}`, {
        headers
      });
      
      if (response.status === 401) {
        browserAuth.clearAuth();
        window.location.href = '/login';
        throw new Error('Authentication required');
      }
      
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  };
  return getCachedOrFetch(cacheKey, fetchFn);
}

export async function fetchCompanies() {
  const cacheKey = 'companies';
  const fetchFn = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/companies', {
        headers
      });
      
      if (response.status === 401) {
        browserAuth.clearAuth();
        window.location.href = '/login';
        throw new Error('Authentication required');
      }
      
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    } catch (error) {
      console.error('Error fetching companies:', error);
      throw error;
    }
  };
  return getCachedOrFetch(cacheKey, fetchFn);
}

// Function to invalidate cache for specific endpoints
export function invalidateCache(endpoint, companyId = null) {
  const key = companyId ? `${endpoint}_${companyId}` : endpoint;
  apiCache.delete(key);
}

// Function to clear entire cache
export function clearCache() {
  apiCache.clear();
} 