// API client using fetch API with localStorage fallback for offline/development usage
import { browserAuth } from '../utils/browserUtils.js';

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
  const token = localStorage.getItem('authToken');
  if (!token || isTokenExpired(token)) {
    console.log('Token expired or invalid, clearing cache...');
    clearAllCache();
    if (token) {
      localStorage.removeItem('authToken');
      window.dispatchEvent(new CustomEvent('auth_expired'));
    }
    return false;
  }
  return true;
};

// Helper function to handle fetch requests with timeout
const fetchWithAuth = async (endpoint, options = {}, timeout = 5000) => {
  // Get auth token from localStorage and check expiration
  const token = localStorage.getItem('authToken');
  
  // Skip token check for public auth endpoints
  const isPublicEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');
  
  if (!isPublicEndpoint) {
    if (!token) {
      return { data: null, error: 'No token provided', useBackup: false };
    }
    
    if (!checkAndClearCacheIfNeeded()) {
      return { data: null, error: 'Authentication expired', useBackup: false };
    }
  }
  
  // Set default headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Add auth token if available and endpoint is not public auth
  if (token && !isPublicEndpoint) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Merge options
  const fetchOptions = {
    ...options,
    headers
  };
  
  try {
    // Create a promise that rejects in <timeout> milliseconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), timeout);
    });
    
    // Create the fetch promise
    const fetchPromise = fetch(`${API_URL}${endpoint}`, fetchOptions);
    
    // Race the fetch against the timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    const data = await response.json();
    
    if (!response.ok) {
      // Check if the error is due to authentication
      if (response.status === 401 || response.status === 403) {
        // Only clear cache and remove token if not a public endpoint
        if (!isPublicEndpoint) {
          clearAllCache();
          localStorage.removeItem('authToken');
          window.dispatchEvent(new CustomEvent('auth_expired'));
        }
      }
      return { data: null, error: data.error || 'An error occurred', useBackup: false };
    }
    
    return { data, error: null, useBackup: false };
  } catch (error) {
    console.error(`Error in fetch to ${endpoint}:`, error);
    return { data: null, error: error.message, useBackup: false };
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
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3000';
let ws = null;

// Cache storage with timestamps
const cache = {
  players: { data: null, timestamp: null },
  companies: { data: null, timestamp: null }
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Initialize WebSocket connection
const initializeWebSocket = () => {
  if (ws) return;

  const token = localStorage.getItem('authToken');
  if (!token) {
    console.log('No auth token available for WebSocket connection');
    return;
  }

  try {
    ws = new WebSocket(WS_URL, [token]);
  } catch (error) {
    console.error('Failed to create WebSocket connection:', error);
    return;
  }

  // Set up heartbeat response
  let heartbeatInterval = null;

  ws.onopen = () => {
    console.log('WebSocket connected');
    
    // Start heartbeat checks
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 25000); // Slightly less than server's interval
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      // Validate received message
      if (!message || !message.type) {
        console.error('Invalid message received:', message);
        return;
      }
      
      handleWebSocketMessage(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onclose = (event) => {
    console.log('WebSocket disconnected:', event.code, event.reason);
    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    // If closed due to authentication failure, don't retry
    if (event.code === 4401) {
      console.log('WebSocket connection closed due to authentication failure');
      return;
    }
    
    // Attempt to reconnect after 5 seconds
    setTimeout(() => {
      ws = null;
      initializeWebSocket();
    }, 5000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    // Clear heartbeat on error
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };
};

// Re-initialize WebSocket when auth token changes
window.addEventListener('storage', (event) => {
  if (event.key === 'authToken') {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (event.newValue) {
      initializeWebSocket();
    }
  }
});

// Initialize WebSocket on import if token exists
if (localStorage.getItem('authToken')) {
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
        const url = companyId ? `${API_URL}/players?company_id=${companyId}` : `${API_URL}/players`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch players: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.error) {
          cache.players = {
            data: data,
            timestamp: Date.now()
          };
        }
        
        return { data, error: null };
      } catch (error) {
        console.error('Error fetching players:', error);
        return { data: null, error: error.message };
      }
    });
  },
  
  create: async (playerData) => {
    try {
      console.log('Creating player with data:', playerData);
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.error('No authentication token found');
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(playerData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Player creation failed:', data);
        throw new Error(data.error || 'Failed to create player');
      }

      console.log('Player created successfully:', data);
      return { data };
    } catch (error) {
      console.error('Error in playerAPI.create:', error);
      return { error: error.message };
    }
  },
  
  update: async (playerId, updates) => {
    try {
      const response = await fetch(`${API_URL}/players/${playerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
      const response = await fetch(`${API_URL}/players/${playerId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      console.log('Deleting player from database:', playerId);
      const response = await fetch(`${API_URL}/players/${playerId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      
      return { error: null };
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
        
        const token = localStorage.getItem('authToken');
        console.log('userAPI.getAll: Using auth token:', token ? 'Present' : 'Missing');

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.status}`);
        }

        const data = await response.json();
        console.log('userAPI.getAll: Received data:', data);
        
        // Update cache with new data
        if (!cache.users) cache.users = {};
        cache.users = {
          data: data,
          timestamp: Date.now()
        };
        
        return { data, error: null };
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

  deleteUser: async (userId) => {
    try {
      console.log('apiClient: Starting deleteUser with ID:', userId);
      
      if (!userId) {
        console.error('apiClient: No user ID provided for deletion');
        return { error: 'No user ID provided' };
      }

      const token = localStorage.getItem('authToken');
      console.log('apiClient: Using auth token:', token ? 'Present' : 'Missing');

      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('apiClient: Delete response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('apiClient: Error deleting user:', errorData);
        return { error: errorData.message || `Failed to delete user: ${response.status}` };
      }

      console.log('apiClient: User deleted successfully');
      
      // Only update cache if the API call was successful
      const cachedUsers = getCachedUsers();
      const filteredUsers = cachedUsers.filter(u => (u.id || u._id) !== userId);
      storeCachedUsers(filteredUsers);
      
      return { data: true, error: null };
    } catch (error) {
      console.error('apiClient: Error in deleteUser:', error);
      return { error: error.message || 'Failed to delete user' };
    }
  }
};

// API functions for authentication
export const authAPI = {
  login: async (credentials) => {
    try {
      const result = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });
      
      // If API call fails, simulate login for testing (development only)
      if (result.useBackup) {
        console.log('Using mock login as backup');
        
        // Only allow the default admin to login in backup mode
        if (credentials.email === 'dashboardplayer@gmail.com' && 
            credentials.password === 'Nummer123') {
          
          // Create a mock token with timestamp
          const mockToken = `mock_token_${Date.now()}`;
          
          // Store user info using browserAuth
          const mockUser = {
            id: 'mock_1',
            email: credentials.email,
            role: 'superadmin',
            company_id: null
          };
          browserAuth.setAuth(mockToken, mockUser);
          
          return { 
            data: { 
              user: mockUser,
              session: { access_token: mockToken }
            }, 
            error: null 
          };
        } else {
          return { data: null, error: 'Invalid credentials' };
        }
      }
      
      // Handle API error response
      if (result.error) {
        return { data: null, error: result.error };
      }
      
      // If successful login through API, store token and user info
      if (result.data?.token && result.data?.user) {
        browserAuth.setAuth(result.data.token, result.data.user);
        return {
          data: {
            user: result.data.user,
            session: { access_token: result.data.token }
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
  
  logout: async () => {
    // Remove token from localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('mock_user');
    return { error: null };
  },
  
  getCurrentUser: async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        return { data: null, error: null };
      }

      // First try to get user from browser storage
      const user = browserAuth.getUser();
      if (user) {
        return { data: { user }, error: null };
      }

      // If no user in storage, verify token with server
      const result = await fetchWithAuth('/auth/verify', {
        method: 'GET'
      });

      if (result.error) {
        browserAuth.clearAuth();
        return { data: null, error: result.error };
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
      console.log('Sending registration invitation with data:', userData);
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.error('No authentication token found');
        return { data: null, error: 'Authentication required' };
      }

      const result = await fetchWithAuth('/auth/register-invitation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: userData.email,
          role: userData.role,
          company_id: userData.company_id || userData.sender_company_id, // Use sender's company if not specified
          sender_role: userData.sender_role || 'bedrijfsadmin', // Default to bedrijfsadmin if not specified
          sender_company_id: userData.sender_company_id
        })
      });

      if (result.error) {
        console.error('Registration invitation failed:', result.error);
        return { data: null, error: result.error };
      }

      console.log('Registration invitation sent successfully:', result.data);
      return result;
    } catch (error) {
      console.error('Registration invitation error:', error);
      return { data: null, error: 'Er is een onverwachte fout opgetreden bij het versturen van de uitnodiging' };
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
      const token = localStorage.getItem('authToken');
      console.log('Auth token present:', !!token);
      
      const response = await fetch(`${API_URL}/users/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
};

// Export a function to manually invalidate cache
export const invalidateCaches = () => {
  Object.keys(cache).forEach(key => invalidateCache(key));
};