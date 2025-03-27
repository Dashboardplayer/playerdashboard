// API client using fetch API with localStorage fallback for offline/development usage
import { browserAuth } from '../utils/browserUtils.js';
import { generateUUID } from '../utils/uuidUtils.js';

const API_URL = 'http://localhost:5001/api';

// Token expiration and cache management
const isTokenExpired = (token) => {
  if (!token) return true;
  
  // Handle mock tokens differently
  if (token.startsWith('mock_token_')) {
    // Mock tokens expire after 24 hours
    const timestamp = parseInt(token.split('_').pop());
    return (Date.now() - timestamp) > (24 * 60 * 60 * 1000);
  }
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    // Check if token has expired
    // Add 1 minute buffer before actual expiration to prevent edge cases
    return (payload.exp * 1000) < (Date.now() - 60000);
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

const handleTokenExpiration = () => {
  console.log('Token expired, clearing auth and cache...');
  clearAllCache();
  browserAuth.clearAuth();
  window.dispatchEvent(new CustomEvent('auth_expired', {
    detail: { message: 'Your session has expired. Please log in again.' }
  }));
  window.location.href = '/login';
};

const clearAllCache = () => {
  console.log('Clearing all cached data...');
  // Clear all cached data
  localStorage.removeItem('cached_players');
  localStorage.removeItem('cached_users');
  localStorage.removeItem('cached_companies');
  localStorage.removeItem('api_users');
  localStorage.removeItem('mock_user');
};

const checkAndClearCacheIfNeeded = () => {
  const token = browserAuth.getToken();
  if (!token || isTokenExpired(token)) {
    handleTokenExpiration();
    return false;
  }
  return true;
};

// Fetch with authentication and error handling
const fetchWithAuth = async (endpoint, options = {}) => {
  try {
    const user = browserAuth.getUser();
    const headers = {
      'Content-Type': 'application/json',
      ...(user?.token ? { 'Authorization': `Bearer ${user.token}` } : {}),
      ...options.headers
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();
    console.log(`API Response (${endpoint}):`, { status: response.status, data });

    // Handle token expiration
    if (response.status === 401 && data.error?.includes('expired')) {
      handleTokenExpiration();
      return { error: 'Session expired' };
    }

    // Handle other 401 Unauthorized
    if (response.status === 401) {
      browserAuth.clearAuth();
      window.location.href = '/login';
      return { error: data.error || 'Unauthorized access' };
    }
    
    if (!response.ok) {
      console.error(`API Error (${endpoint}):`, { status: response.status, data });
      return { error: data.error || `API request failed with status ${response.status}` };
    }

    return { data, error: null };
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    return { error: error.message || 'Network error', useBackup: true };
  }
};

// Helper function to get cached companies from localStorage
const getCachedCompanies = () => {
  try {
    return JSON.parse(localStorage.getItem('cached_companies') || '[]');
  } catch (error) {
    console.error('Error parsing cached companies:', error);
    return [];
  }
};

// Helper function to store cached companies in localStorage
const storeCachedCompanies = (companies) => {
  localStorage.setItem('cached_companies', JSON.stringify(companies));
};

// WebSocket connection
const WS_URL = process.env.NODE_ENV === 'production' 
  ? `wss://${window.location.host}`
  : `ws://localhost:5001`;

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds

// Cache storage with timestamps
const cache = {
  players: { data: null, timestamp: null },
  companies: { data: null, timestamp: null }
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Initialize WebSocket connection
function initializeWebSocket() {
  try {
    const user = browserAuth.getUser();
    
    if (!user || !user.token) {
      console.log('No valid auth token or user available for WebSocket connection');
      return;
    }

    const protocols = [`jwt.${user.token}`];
    ws = new WebSocket(WS_URL, protocols);
    
    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      reconnectAttempts = 0; // Reset attempts on successful connection
      
      // Send an initial authentication message with additional security measures
      ws.send(JSON.stringify({ 
        type: 'authenticate',
        token: user.token,
        timestamp: Date.now(),
        clientId: generateUUID(),
        userId: user.id
      }));
    };

    ws.onclose = async (event) => {
      console.log('WebSocket disconnected:', event.code);
      
      // Check if we have a valid token before attempting to reconnect
      const currentUser = browserAuth.getUser();
      
      if (!currentUser || !currentUser.token) {
        console.log('No valid session for reconnection');
        return;
      }

      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => {
          reconnectAttempts++;
          console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          initializeWebSocket();
        }, RECONNECT_DELAY * Math.pow(2, reconnectAttempts)); // Exponential backoff
      } else {
        console.log('Max reconnection attempts reached');
        // Reset reconnection attempts after a longer delay
        setTimeout(() => {
          reconnectAttempts = 0;
          initializeWebSocket();
        }, RECONNECT_DELAY * 5);
      }
    };

    ws.onerror = (error) => {
      console.log('WebSocket error occurred:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle authentication errors
        if (data.type === 'auth_error') {
          console.log('WebSocket authentication error:', data.message);
          ws.close();
          return;
        }
        
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };
  } catch (error) {
    console.error('Error initializing WebSocket');
  }
}

// Re-initialize WebSocket when auth token changes
window.addEventListener('storage', (event) => {
  if (event.key === 'authToken') {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (event.newValue) {
      reconnectAttempts = 0; // Reset attempts when token changes
      initializeWebSocket();
    }
  }
});

// Initialize WebSocket on import if we have valid auth
if (browserAuth.getUser()) {
  initializeWebSocket();
}

// Handle incoming WebSocket messages
const handleWebSocketMessage = (message) => {
  // Ignore heartbeat messages
  if (message.type === 'heartbeat') return;

  console.log('Received WebSocket message:', message);

  switch (message.type) {
    case 'company_created':
    case 'company_updated':
    case 'company_deleted':
      console.log('Invalidating companies cache');
      invalidateCache('companies');
      // Also invalidate users and players as they might be affected
      invalidateCache('users');
      invalidateCache('players');
      break;
    case 'player_created':
    case 'player_updated':
    case 'player_deleted':
      console.log('Invalidating players cache');
      invalidateCache('players');
      break;
    case 'user_created':
    case 'user_updated':
    case 'user_deleted':
      console.log('Invalidating users cache');
      invalidateCache('users');
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
};

// Cache invalidation
const invalidateCache = (type) => {
  if (cache[type]) {
    cache[type].data = null;
    cache[type].timestamp = null;
  }
};

// Request deduplication system
const pendingRequests = new Map();

const deduplicateRequest = async (key, requestFn) => {
  // Check if there's already a pending request for this key
  if (pendingRequests.has(key)) {
    console.log(`Using pending request for ${key}`);
    return pendingRequests.get(key);
  }

  // Create new request promise
  const requestPromise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });

  // Store the promise
  pendingRequests.set(key, requestPromise);
  return requestPromise;
};

// Modified API functions with request deduplication
export const companyAPI = {
  getAll: async () => {
    const cacheKey = 'companies';
    
    // Check cache validity first
    if (cache.companies.data && Date.now() - cache.companies.timestamp < CACHE_DURATION) {
      console.log('Using cached companies data');
      return { data: cache.companies.data, error: null };
    }

    return deduplicateRequest('getCompanies', async () => {
      try {
        const result = await fetchWithAuth('/companies', { method: 'GET' });
        
        if (!result.error) {
          cache.companies = {
            data: result.data,
            timestamp: Date.now()
          };
        }
        
        return result;
      } catch (error) {
        console.error('Error fetching companies:', error);
        return { data: null, error: error.message };
      }
    });
  },
  
  create: async (companyData) => {
    const result = await fetchWithAuth('/companies', {
      method: 'POST',
      body: JSON.stringify(companyData)
    });
    
    // If API call fails, store locally
    if (result.useBackup) {
      console.log('Storing company locally as backup');
      const cachedCompanies = getCachedCompanies();
      
      // Create a mock company with ID
      const newCompany = {
        ...companyData,
        _id: 'local_' + Date.now()
      };
      
      // Add to cache
      cachedCompanies.push(newCompany);
      storeCachedCompanies(cachedCompanies);
      
      return { data: newCompany, error: null };
    }
    
    // If successful, update cache
    if (result.data && !result.error) {
      const cachedCompanies = getCachedCompanies();
      cachedCompanies.push(result.data);
      storeCachedCompanies(cachedCompanies);
    }
    
    return result;
  }
};

// Helper function to get cached players from localStorage
const getCachedPlayers = () => {
  try {
    return JSON.parse(localStorage.getItem('cached_players') || '[]');
  } catch (error) {
    console.error('Error parsing cached players:', error);
    return [];
  }
};

// Helper function to store cached players in localStorage
const storeCachedPlayers = (players) => {
  localStorage.setItem('cached_players', JSON.stringify(players));
};

// Modified API functions with request deduplication
export const playerAPI = {
  getAll: async (companyId = null) => {
    const cacheKey = `players_${companyId || 'all'}`;
    
    // Check cache validity first
    if (cache.players.data && Date.now() - cache.players.timestamp < CACHE_DURATION) {
      console.log('Using cached players data');
      const cachedData = companyId
        ? cache.players.data.filter(player => player.company_id === companyId)
        : cache.players.data;
      return { data: cachedData, error: null };
    }

    return deduplicateRequest(cacheKey, async () => {
      try {
        const user = browserAuth.getUser();
        
        if (!user || !user.token) {
          console.error('No authentication token or user found');
          throw new Error('Authentication required');
        }

        // If user is not superadmin, force filter by their company_id
        if (user.role !== 'superadmin' && !companyId) {
          companyId = user.company_id;
        }

        const url = companyId ? `${API_URL}/players?company_id=${companyId}` : `${API_URL}/players`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch players: ${response.status}`);
        }

        const data = await response.json();
        
        // Filter data by company_id if user is not superadmin
        const filteredData = user.role === 'superadmin'
          ? data
          : data.filter(player => player.company_id === user.company_id);

        if (!data.error) {
          cache.players = {
            data: filteredData,
            timestamp: Date.now()
          };
        }
        
        return { data: filteredData, error: null };
      } catch (error) {
        console.error('Error fetching players:', error);
        return { data: null, error: error.message };
      }
    });
  },
  
  create: async (playerData) => {
    try {
      console.log('Creating player with data:', {
        name: playerData.name,
        company_id: playerData.company_id
      });
      
      const currentUser = browserAuth.getUser();
      
      if (!currentUser || !currentUser.token) {
        console.error('No authentication token or user found');
        throw new Error('Authentication required');
      }

      // If company_id is not provided, use the current user's company_id
      const finalPlayerData = {
        ...playerData,
        company_id: playerData.company_id || currentUser.company_id
      };

      const response = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify(finalPlayerData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Player creation failed:', data);
        throw new Error(data.error || 'Failed to create player');
      }

      console.log('Player created successfully:', {
        id: data.id,
        name: data.name,
        company_id: data.company_id
      });
      
      return { data };
    } catch (error) {
      console.error('Error in playerAPI.create:', error);
      return { error: error.message };
    }
  },
  
  update: async (playerId, updates) => {
    try {
      const user = browserAuth.getUser();
      
      if (!user || !user.token) {
        console.error('No authentication token or user found');
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_URL}/players/${playerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update player');
      }

      const data = await response.json();
      
      // Update cache
      const cachedPlayers = getCachedPlayers();
      const playerIndex = cachedPlayers.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        cachedPlayers[playerIndex] = data;
        storeCachedPlayers(cachedPlayers);
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Error updating player:', error);
      return { data: null, error: error.message };
    }
  },

  createCommand: async (playerId, commandData) => {
    try {
      const user = browserAuth.getUser();
      
      if (!user || !user.token) {
        console.error('No authentication token or user found');
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_URL}/players/${playerId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          command_type: commandData.type,
          payload: commandData.payload || {}
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create command');
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('Error creating command:', error);
      return { data: null, error: error.message };
    }
  },

  delete: async (playerId) => {
    try {
      const user = browserAuth.getUser();
      
      if (!user || !user.token) {
        console.error('No authentication token or user found');
        throw new Error('Authentication required');
      }

      console.log('Deleting player from database:', playerId);
      const response = await fetch(`${API_URL}/players/${playerId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        }
      });

      // First check if response is ok
      if (!response.ok) {
        // Try to parse error response as JSON
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error;
        } catch (e) {
          // If parsing fails, use status text
          errorMessage = `Failed to delete player (${response.status}: ${response.statusText})`;
        }
        throw new Error(errorMessage);
      }

      // Clear all cached data to ensure fresh state
      clearAllCache();
      
      return { data: { success: true }, error: null };
    } catch (error) {
      console.error('Error deleting player:', error);
      return { error: error.message };
    }
  }
};

// Helper function to get cached users from localStorage
const getCachedUsers = () => {
  try {
    return JSON.parse(localStorage.getItem('cached_users') || '[]');
  } catch (error) {
    console.error('Error parsing cached users:', error);
    return [];
  }
};

// Helper function to store cached users in localStorage
const storeCachedUsers = (users) => {
  localStorage.setItem('cached_users', JSON.stringify(users));
};

// Modified API functions with request deduplication
export const userAPI = {
  getAll: async (companyId = null) => {
    const cacheKey = `users_${companyId || 'all'}`;
    
    // Check cache validity first
    if (cache.users?.data && Date.now() - cache.users.timestamp < CACHE_DURATION) {
      console.log('Using cached users data');
      const cachedData = companyId
        ? cache.users.data.filter(user => user.company_id === companyId)
        : cache.users.data;
      return { data: cachedData, error: null };
    }

    return deduplicateRequest(cacheKey, async () => {
      try {
        console.log('userAPI.getAll: Starting fetch', { companyId });
        const url = companyId ? `${API_URL}/users?company_id=${companyId}` : `${API_URL}/users`;
        const user = browserAuth.getUser();

        // If user is not superadmin, force filter by their company_id
        if (user && user.role !== 'superadmin' && !companyId) {
          companyId = user.company_id;
        }

        const response = await fetch(companyId ? `${API_URL}/users?company_id=${companyId}` : `${API_URL}/users`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.status}`);
        }

        const data = await response.json();
        console.log('userAPI.getAll: Received data:', data);
        
        // Filter data by company_id if user is not superadmin
        const filteredData = user?.role === 'superadmin' 
          ? data 
          : data.filter(u => u.company_id === user.company_id);

        // Update cache with filtered data
        if (!cache.users) cache.users = {};
        cache.users = {
          data: filteredData,
          timestamp: Date.now()
        };
        
        return { data: filteredData, error: null };
      } catch (error) {
        console.error('userAPI.getAll: Error:', error);
        return { data: null, error: error.message };
      }
    });
  },
  
  create: async (userData) => {
    const result = await fetchWithAuth('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    
    // If API call fails, store locally
    if (result.useBackup) {
      console.log('Storing user locally as backup');
      const cachedUsers = getCachedUsers();
      
      // Create a mock user with ID
      const newUser = {
        ...userData,
        id: 'local_' + Date.now(),
        _id: 'local_' + Date.now()
      };
      
      // Add to cache
      cachedUsers.push(newUser);
      storeCachedUsers(cachedUsers);
      
      return { data: newUser, error: null };
    }
    
    // If successful, update cache
    if (result.data && !result.error) {
      const cachedUsers = getCachedUsers();
      cachedUsers.push(result.data);
      storeCachedUsers(cachedUsers);
    }
    
    return result;
  },
  
  update: async (userId, updates) => {
    const result = await fetchWithAuth(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    
    // If API call fails, update locally
    if (result.useBackup) {
      console.log('Updating user locally as backup');
      const cachedUsers = getCachedUsers();
      
      // Find and update the user
      const userIndex = cachedUsers.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        cachedUsers[userIndex] = {
          ...cachedUsers[userIndex],
          ...updates
        };
        storeCachedUsers(cachedUsers);
        return { data: cachedUsers[userIndex], error: null };
      }
      
      return { data: null, error: 'User not found' };
    }
    
    // If successful, update cache
    if (result.data && !result.error) {
      const cachedUsers = getCachedUsers();
      const userIndex = cachedUsers.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        cachedUsers[userIndex] = result.data;
        storeCachedUsers(cachedUsers);
      }
    }
    
    return result;
  },

  delete: async (userId) => {
    try {
      console.log('Deleting user with ID:', userId);
      const result = await fetchWithAuth(`/users/${userId}`, {
        method: 'DELETE'
      });

      if (result.error) {
        console.error('Error deleting user:', result.error);
        return { error: result.error };
      }

      // Update cache by removing the deleted user
      const cachedUsers = getCachedUsers();
      const updatedUsers = cachedUsers.filter(u => u.id !== userId && u._id !== userId);
      storeCachedUsers(updatedUsers);

      return { data: { success: true }, error: null };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { error: error.message };
    }
  },
};

// API functions for authentication
export const authAPI = {
  login: async (credentials) => {
    try {
      const result = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      
      // Handle API error response
      if (result.error) {
        return { data: null, error: result.error };
      }
      
      // Handle 2FA response
      if (result.data?.requires2FA) {
        return {
          data: {
            requires2FA: true,
            tempToken: result.data.tempToken
          },
          error: null
        };
      }
      
      // If successful login through API, store token and user info
      if (result.data?.token && result.data?.refreshToken && result.data?.user) {
        browserAuth.setAuth(result.data.token, result.data.refreshToken, result.data.user);
        return {
          data: {
            user: result.data.user,
            token: result.data.token,
            refreshToken: result.data.refreshToken
          },
          error: null
        };
      }
      
      return { data: null, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Login error:', error);
      return { data: null, error: error.message };
    }
  },
  
  register: async (userData) => {
    const result = await fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    
    // If registration was successful, store the token
    if (result.data && !result.error) {
      browserAuth.setAuth(result.data.token, result.data.user);
    }
    
    return result;
  },
  
  completeRegistration: async (data) => {
    try {
      console.log('Completing registration for user:', { 
        token: data.token ? '***' : undefined,
        email: data.email
      });

      const response = await fetch(`${API_URL}/auth/complete-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}` // Include the registration token
        },
        body: JSON.stringify({
          password: data.password,
          token: data.token
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Registration completion failed:', errorData);
        return { error: errorData.message || `Failed to complete registration: ${response.status}` };
      }

      const result = await response.json();
      
      // If registration completion was successful, store the token
      if (result.token && result.user) {
        browserAuth.setAuth(result.token, result.user);
        console.log('Registration completed successfully for:', {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role
        });
      }
      
      return { data: result, error: null };
    } catch (error) {
      console.error('Error completing registration:', error);
      return { error: error.message || 'Failed to complete registration' };
    }
  },
  
  logout: async () => {
    browserAuth.clearAuth();
    if (ws) {
      ws.close();
      ws = null;
    }
    return { error: null };
  },
  
  getCurrentUser: async () => {
    try {
      // First try to get user from browser storage
      const user = browserAuth.getUser();
      
      if (!user) {
        return { data: null, error: null };
      }

      if (user) {
        // If we have both token and user in storage, return the user
        return { data: { user }, error: null };
      }

      // Only verify with server if we have a token but no user
      const result = await fetchWithAuth('/auth/verify', {
        method: 'GET'
      });

      if (result.error) {
        browserAuth.clearAuth();
        return { data: null, error: result.error };
      }

      // Store the user data if we got it from the server
      if (result.data?.user) {
        browserAuth.setAuth(result.data.token, result.data.user);
      }

      return result;
    } catch (error) {
      console.error('Error getting current user:', error);
      return { data: null, error: error.message };
    }
  },

  getUserById: async (userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        // If API call fails, use cached data
        console.log('Using cached user as backup');
        const cachedUsers = getCachedUsers();
        const user = cachedUsers.find(u => u.id === userId);
        return { data: user || null, error: null };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching user:', error);
      // On error, try to use cached data
      const cachedUsers = getCachedUsers();
      const user = cachedUsers.find(u => u.id === userId);
      return { data: user || null, error: null };
    }
  },

  getUserByEmail: async (email) => {
    try {
      const response = await fetch(`${API_URL}/users?email=${email}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        // If API call fails, use cached data
        console.log('Using cached user as backup');
        const cachedUsers = getCachedUsers();
        const user = cachedUsers.find(u => u.email === email);
        return { data: user || null, error: null };
      }

      const data = await response.json();
      return { data: data[0] || null, error: null };
    } catch (error) {
      console.error('Error fetching user:', error);
      // On error, try to use cached data
      const cachedUsers = getCachedUsers();
      const user = cachedUsers.find(u => u.email === email);
      return { data: user || null, error: null };
    }
  },

  updateUser: async (userId, updates) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        // If API call fails, update locally
        console.log('Updating user locally as backup');
        const cachedUsers = getCachedUsers();
        const userIndex = cachedUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
          cachedUsers[userIndex] = {
            ...cachedUsers[userIndex],
            ...updates
          };
          storeCachedUsers(cachedUsers);
          return { data: cachedUsers[userIndex], error: null };
        }
        return { data: null, error: 'User not found' };
      }

      const data = await response.json();
      
      // Update cache
      const cachedUsers = getCachedUsers();
      const userIndex = cachedUsers.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        cachedUsers[userIndex] = data;
        storeCachedUsers(cachedUsers);
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Error updating user:', error);
      return { data: null, error };
    }
  },

  get: async (endpoint) => {
    try {
      const result = await fetchWithAuth(endpoint, {
        method: 'GET'
      });

      if (result.useBackup) {
        // If we're checking session and API is down
        if (endpoint === '/check-session') {
          const token = localStorage.getItem('authToken');
          const user = browserAuth.getUser();
          
          if (token && user) {
            return { data: { user }, error: null };
          }
          return { data: null, error: 'No session found' };
        }
      }

      return result;
    } catch (error) {
      console.error(`Error in authAPI.get(${endpoint}):`, error);
      return { data: null, error: error.message };
    }
  },

  registerInvitation: async (userData) => {
    try {
      console.log('Sending registration invitation with data:', {
        email: userData.email,
        role: userData.role,
        company_id: userData.company_id || userData.sender_company_id
      });
      
      const user = browserAuth.getUser();
      
      if (!user || !user.token) {
        console.error('No authentication token or user found');
        return { data: null, error: 'Authentication required' };
      }

      const result = await fetchWithAuth('/auth/register-invitation', {
        method: 'POST',
        body: JSON.stringify({
          email: userData.email,
          role: userData.role,
          company_id: userData.company_id || userData.sender_company_id, // Use current user's company if not specified
          sender_role: userData.role,
          sender_company_id: userData.company_id || userData.sender_company_id
        })
      });

      if (result.error) {
        console.error('Registration invitation failed:', result.error);
        return { data: null, error: result.error };
      }

      console.log('Registration invitation sent successfully:', {
        email: result.data.email,
        role: result.data.role,
        company_id: result.data.company_id
      });
      
      return result;
    } catch (error) {
      console.error('Registration invitation error:', error);
      return { data: null, error: 'Er is een fout opgetreden bij het versturen van de uitnodiging' };
    }
  },

  verifyToken: async (token) => {
    try {
      const result = await fetchWithAuth(`/auth/verify-token?token=${token}`, {
        method: 'GET'
      });
      return result;
    } catch (error) {
      console.error('Token verification error:', error);
      return { data: null, error: error.message };
    }
  },

  updatePassword: async ({ currentPassword, newPassword }) => {
    try {
      console.log('Attempting to update password at:', `${API_URL}/users/update-password`);
      const user = browserAuth.getUser();
      console.log('Auth token present:', !!user?.token);
      
      const response = await fetch(`${API_URL}/users/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      console.log('Password update response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          return { error: 'Huidig wachtwoord is incorrect' };
        }
        if (response.status === 404) {
          return { error: 'Endpoint niet gevonden. Neem contact op met de beheerder.' };
        }
        const errorData = await response.json().catch(() => ({ 
          message: 'Er is een onverwachte fout opgetreden' 
        }));
        console.error('Password update error response:', errorData);
        return { error: errorData.message || 'Failed to update password' };
      }

      const data = await response.json();
      console.log('Password update successful:', data);
      return { data, error: null };
    } catch (error) {
      console.error('Error updating password:', error);
      return { error: 'Er is een onverwachte fout opgetreden' };
    }
  },

  // 2FA Methods
  generate2FASecret: async () => {
    try {
      const result = await fetchWithAuth('/auth/2fa/generate', {
        method: 'POST'
      });

      console.log('2FA secret generation response:', result);

      if (result.error) {
        return { error: result.error };
      }

      // Make sure we have both the secret and QR code
      if (!result.data?.secret || !result.data?.qrCode) {
        console.error('Invalid 2FA secret response:', result);
        return { error: 'Incomplete response from server' };
      }

      return {
        data: {
          secret: result.data.secret,
          qrCode: result.data.qrCode
        },
        error: null
      };
    } catch (error) {
      console.error('Error generating 2FA secret:', error);
      return { error: error.message };
    }
  },

  verify2FASetup: async (token) => {
    try {
      const result = await fetchWithAuth('/auth/2fa/verify-setup', {
        method: 'POST',
        body: JSON.stringify({ token })
      });

      if (result.error) {
        return { error: result.error };
      }

      return result;
    } catch (error) {
      console.error('Error verifying 2FA setup:', error);
      return { error: error.message };
    }
  },

  verify2FA: async (verificationData) => {
    try {
      const response = await fetch(`${API_URL}/auth/2fa/verify-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(verificationData)
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Failed to verify 2FA' };
      }

      // If verification successful, store the final token and user info
      if (data.token && data.user) {
        browserAuth.setAuth(data.token, data.user);
      }

      return { data, error: null };
    } catch (error) {
      console.error('2FA verification error:', error);
      return { error: error.message };
    }
  },

  disable2FA: async (token) => {
    try {
      const result = await fetchWithAuth('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ token })
      });

      if (result.error) {
        return { error: result.error };
      }

      return result;
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      return { error: error.message };
    }
  },

  get2FAStatus: async () => {
    try {
      const result = await fetchWithAuth('/auth/2fa/status', {
        method: 'GET'
      });

      console.log('2FA status response:', result);

      if (result.error) {
        return { error: result.error };
      }

      // Return the data in a consistent format
      return {
        data: {
          enabled: result.data?.enabled || false,
          pendingSetup: result.data?.pendingSetup || false
        },
        error: null
      };
    } catch (error) {
      console.error('Error getting 2FA status:', error);
      return { error: error.message };
    }
  },

  verify2FALogin: async ({ token, tempToken }) => {
    try {
      if (!token || !tempToken) {
        console.error('Missing required parameters for 2FA verification:', { token: !!token, tempToken: !!tempToken });
        return { error: 'Missing required parameters' };
      }

      const response = await fetch(`${API_URL}/auth/2fa/verify-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, tempToken })
      });

      const data = await response.json();
      console.log('2FA verification API response:', data);

      if (!response.ok) {
        return { error: data.error || 'Verification failed' };
      }

      if (data.token && data.user) {
        // Store both tokens
        browserAuth.setAuth(data.token, data.refreshToken, data.user);
        return {
          data: {
            user: data.user,
            token: data.token,
            refreshToken: data.refreshToken
          },
          error: null
        };
      }

      return { data: null, error: 'Invalid response from server' };
    } catch (error) {
      console.error('2FA verification error:', error);
      return { data: null, error: error.message };
    }
  },

  checkSession: async () => {
    const user = browserAuth.getUser();
    
    if (!user) {
      return { data: null, error: 'No active session' };
    }

    try {
      const result = await fetchWithAuth('/auth/check-session');
      
      if (result.error) {
        browserAuth.clearAuth();
        return { data: null, error: result.error };
      }
      
      return { data: { user }, error: null };
    } catch (error) {
      console.error('Session check error:', error);
      return { data: null, error: error.message };
    }
  }
};

// Export a function to manually invalidate cache
export const invalidateCaches = () => {
  Object.keys(cache).forEach(key => invalidateCache(key));
};