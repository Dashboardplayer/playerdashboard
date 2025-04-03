// API client using fetch API with localStorage fallback for offline/development usage
const { browserAuth } = require('../utils/browserUtils');
const { generateUUID } = require('../utils/uuidUtils');
const { secureLog } = require('../utils/secureLogger');

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Constants for token management
const TOKEN_EXPIRY_BUFFER = 60000; // 1 minute buffer
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const TOKEN_CHECK_INTERVAL = 30000; // Check token every 30 seconds

// Helper function to get cached companies from localStorage
const getCachedCompanies = () => {
  try {
    return JSON.parse(localStorage.getItem('cached_companies') || '[]');
  } catch (error) {
    secureLog.error('Error parsing cached companies');
    return [];
  }
};

// Helper function to store cached companies in localStorage
const storeCachedCompanies = (companies) => {
  localStorage.setItem('cached_companies', JSON.stringify(companies));
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

// Helper function to get cached users from localStorage
const getCachedUsers = () => {
  try {
    return JSON.parse(localStorage.getItem('cached_users') || '[]');
  } catch (error) {
    secureLog.error('Error parsing cached users');
    return [];
  }
};

// Helper function to store cached users in localStorage
const storeCachedUsers = (users) => {
  localStorage.setItem('cached_users', JSON.stringify(users));
};

let lastActivityTimestamp = Date.now();
let activityCheckInterval = null;

// Update last activity timestamp on user interaction
const updateLastActivity = () => {
  lastActivityTimestamp = Date.now();
};

// Add event listeners for user activity
const setupActivityListeners = () => {
  const events = ['mousedown', 'keydown', 'mousemove', 'wheel', 'touchstart', 'scroll'];
  
  events.forEach(event => {
    window.addEventListener(event, updateLastActivity, { passive: true });
  });
};

// Remove activity listeners
const cleanupActivityListeners = () => {
  const events = ['mousedown', 'keydown', 'mousemove', 'wheel', 'touchstart', 'scroll'];
  
  events.forEach(event => {
    window.removeEventListener(event, updateLastActivity);
  });
};

// Add a flag to prevent multiple logout attempts
let isHandlingExpiration = false;

const handleTokenExpiration = async (reason = 'expired') => {
  // Prevent multiple simultaneous logout attempts
  if (isHandlingExpiration) {
    return;
  }
  
  try {
    isHandlingExpiration = true;
    
    // Clear WebSocket connection
    if (ws) {
      ws.close();
      ws = null;
      window.ws = null;
    }

    // Clear any pending reconnect attempts
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    // Clear authentication state
    browserAuth.clearAuth();
    
    // Clear all cached data
    clearAllCache();
    
    // Dispatch logout event
    window.dispatchEvent(new CustomEvent('auth-expired', {
      detail: { reason }
    }));

    // Force redirect to login if not already there
    const currentPath = window.location.pathname;
    if (!currentPath.includes('/login')) {
      window.location.href = '/login';
    }
  } finally {
    isHandlingExpiration = false;
  }
};

// Update isTokenExpired to be more strict
const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    // For mock token in development
    if (process.env.NODE_ENV === 'development' && token === 'mock-token') {
      return false;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeUntilExpiry = expirationTime - currentTime;

    // If token is expired or about to expire in the next minute
    if (timeUntilExpiry <= 60000) { // 1 minute buffer
      handleTokenExpiration('expired');
      return true;
    }

    return false;
  } catch (error) {
    secureLog.error('Token validation error', { error: error.message });
    handleTokenExpiration('invalid');
    return true;
  }
};

// Update fetchWithAuth to handle token expiration
const fetchWithAuth = async (endpoint, options = {}) => {
  const user = browserAuth.getUser();
  
  if (!user || !user.token || isTokenExpired(user.token)) {
    handleTokenExpiration('expired');
    return { error: 'Authentication required', useBackup: true };
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    // Check for token expiration in response
    if (response.status === 401 || 
        (data.error && (
          data.error.includes('jwt expired') || 
          data.error.includes('invalid token') ||
          data.error.includes('Token expired')
        ))) {
      handleTokenExpiration('expired');
      return { error: 'Session expired', useBackup: true };
    }

    return { data, error: null };
  } catch (error) {
    secureLog.error('API request failed', {
      endpoint,
      error: error.message
    });
    return { error: error.message, useBackup: true };
  }
};

// Token expiration and cache management
const clearAllCache = () => {
  secureLog.info('Clearing application cache');
  localStorage.removeItem('cached_players');
  localStorage.removeItem('cached_users');
  localStorage.removeItem('cached_companies');
  localStorage.removeItem('api_users');
  localStorage.removeItem('mock_user');
};

// Start token expiration checker
const startTokenExpirationChecker = () => {
  // Set up activity monitoring
  setupActivityListeners();
  updateLastActivity(); // Initialize last activity
  
  const checkToken = () => {
    const user = browserAuth.getUser();
    if (!user?.token) return;
    
    const inactiveTime = Date.now() - lastActivityTimestamp;
    
    // Check for inactivity timeout
    if (inactiveTime >= INACTIVITY_TIMEOUT) {
      handleTokenExpiration('inactivity');
      return;
    }
    
    // Check actual token expiration
    if (isTokenExpired(user.token)) {
      handleTokenExpiration('expired');
    }
  };
  
  // Clear any existing interval
  if (activityCheckInterval) {
    clearInterval(activityCheckInterval);
  }
  
  // Check immediately
  checkToken();
  
  // Set up new interval
  activityCheckInterval = setInterval(checkToken, TOKEN_CHECK_INTERVAL);
  
  // Clean up on page unload
  window.addEventListener('unload', () => {
    if (activityCheckInterval) {
      clearInterval(activityCheckInterval);
    }
    cleanupActivityListeners();
  });
};

// Initialize token checker when user logs in
const initializeSession = () => {
  startTokenExpirationChecker();
};

// WebSocket connection
const WS_URL = process.env.NODE_ENV === 'production' 
  ? `wss://player-dashboard.onrender.com/api`
  : 'ws://localhost:5001/api';

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds
let reconnectTimeout = null;

// Cache storage with timestamps
const cache = {
  players: { data: null, timestamp: null },
  companies: { data: null, timestamp: null },
  users: { data: null, timestamp: null }
};

// Increase cache duration since we're using WebSockets for real-time updates
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Add connection state tracking
let isConnecting = false;
let lastConnectionAttempt = 0;
const MIN_RECONNECT_DELAY = 5000; // Minimum 5 seconds between connection attempts

// Initialize WebSocket connection
function initializeWebSocket() {
  try {
    const user = browserAuth.getUser();
    
    if (!user || !user.token) {
      secureLog.warn('WebSocket connection failed: No valid authentication');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      secureLog.warn('WebSocket connection already in progress');
      return;
    }

    // Enforce minimum delay between connection attempts
    const now = Date.now();
    if (now - lastConnectionAttempt < MIN_RECONNECT_DELAY) {
      secureLog.warn('WebSocket reconnection attempted too soon');
      return;
    }

    // Close existing connection if any
    if (ws) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        secureLog.info('Closing existing WebSocket connection');
        ws.close();
      }
      ws = null;
    }

    // Clear any pending reconnect
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    isConnecting = true;
    lastConnectionAttempt = now;

    // Create WebSocket with authentication token in protocol
    const protocols = [`jwt.${user.token}`];
    ws = new WebSocket(WS_URL, protocols);
    
    window.ws = ws;
    
    ws.onopen = () => {
      secureLog.info('WebSocket connection established');
      isConnecting = false;
      reconnectAttempts = 0;
      
      // Send initial heartbeat
      ws.send(JSON.stringify({ 
        type: 'heartbeat',
        timestamp: Date.now()
      }));
    };

    ws.onclose = async (event) => {
      secureLog.info('WebSocket disconnected', { code: event.code });
      
      // Clear connection state
      isConnecting = false;
      ws = null;
      window.ws = null;
      
      // Check if we have a valid token before attempting to reconnect
      const currentUser = browserAuth.getUser();
      
      if (!currentUser || !currentUser.token) {
        secureLog.warn('WebSocket reconnection failed: No valid session');
        return;
      }

      // Handle authentication errors
      if (event.code === 4401) {
        secureLog.warn('WebSocket authentication failed, clearing session');
        handleTokenExpiration('expired');
        return;
      }

      // Only attempt reconnection if we haven't reached the maximum attempts
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++;
          secureLog.info('Attempting WebSocket reconnection', { 
            attempt: reconnectAttempts,
            maxAttempts: MAX_RECONNECT_ATTEMPTS,
            delay: delay
          });
          initializeWebSocket();
        }, delay);
      } else {
        secureLog.warn('WebSocket max reconnection attempts reached');
        // Reset reconnection attempts after a longer delay
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts = 0;
          initializeWebSocket();
        }, RECONNECT_DELAY * 5);
      }
    };

    ws.onerror = (error) => {
      secureLog.error('WebSocket error occurred', { 
        message: error.message,
        readyState: ws?.readyState
      });
      isConnecting = false;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        secureLog.error('WebSocket message parsing error', { error: error.message });
      }
    };
  } catch (error) {
    secureLog.error('WebSocket initialization error', { error: error.message });
    isConnecting = false;
  }
}

// Modify the storage event listener to be more precise
window.removeEventListener('storage', initializeWebSocket); // Remove any existing listener
window.addEventListener('storage', (event) => {
  if (event.key === 'authToken' && event.newValue) {
    // Only reinitialize if we don't have an active connection
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reconnectAttempts = 0;
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
  try {
    // Handle authentication errors in WebSocket messages
    if (message.type === 'error' && message.error?.includes('jwt expired')) {
      handleTokenExpiration('expired');
      return;
    }

    // Handle heartbeat responses
    if (message.type === 'heartbeat') {
      return;
    }

    // Handle entity updates
    switch (message.type) {
      case 'company_created':
      case 'company_updated':
      case 'company_deleted':
        invalidateCache('companies');
        window.dispatchEvent(new CustomEvent('company_update', { 
          detail: { type: message.type, data: message.data }
        }));
        break;
        
      case 'player_created':
      case 'player_updated':
      case 'player_deleted':
        invalidateCache('players');
        window.dispatchEvent(new CustomEvent('player_update', { 
          detail: { type: message.type, data: message.data }
        }));
        break;
        
      case 'user_created':
      case 'user_updated':
      case 'user_deleted':
        invalidateCache('users');
        window.dispatchEvent(new CustomEvent('user_update', { 
          detail: { type: message.type, data: message.data }
        }));
        break;
        
      default:
        secureLog.warn('Unknown WebSocket message type', { type: message.type });
    }
  } catch (error) {
    secureLog.error('WebSocket message handling error', { error: error.message });
  }
};

// Cache invalidation
const invalidateCache = (type) => {
  if (cache[type]) {
    cache[type].data = null;
    cache[type].timestamp = null;
  }
};

// A simpler debounce implementation
const pendingRequests = new Map();

const debounce = (key, fn, wait) => {
  // Check if there's already a pending request
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // Create a new promise for this request
  const promise = new Promise((resolve) => {
    setTimeout(async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        console.error(`Error in debounced function for ${key}:`, error);
        resolve({ error: error.message });
      } finally {
        // Remove from pending requests after execution
        pendingRequests.delete(key);
      }
    }, wait);
  });

  // Store the promise
  pendingRequests.set(key, promise);
  
  return promise;
};

// Modified API functions with request deduplication
const companyAPI = {
  getAll: async () => {
    const cacheKey = 'companies';
    
    // Check cache validity first
    if (cache.companies.data && Date.now() - cache.companies.timestamp < CACHE_DURATION) {
      console.log('Using cached companies data');
      return { data: cache.companies.data, error: null };
    }

    return debounce('getCompanies', async () => {
      try {
        const user = browserAuth.getUser();
        
        if (!user || !user.token) {
          console.error('No authentication token or user found');
          throw new Error('Authentication required');
        }

        const response = await fetch(`${API_URL}/companies`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch companies: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache the data
        cache.companies = {
          data: data,
          timestamp: Date.now()
        };
        
        // Store in localStorage for offline access
        storeCachedCompanies(data);
        
        return { data: data, error: null };
      } catch (error) {
        console.error('Error fetching companies');
        
        // Try to get data from localStorage if available
        const cachedData = getCachedCompanies();
        if (cachedData && cachedData.length > 0) {
          return { data: cachedData, error: null, fromCache: true };
        }
        
        return { data: null, error: error.message };
      }
    }, 300);
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

// Modified API functions with request deduplication
const playerAPI = {
  getAll: async (companyId = null) => {
    try {
      const cacheKey = `players_${companyId || 'all'}`;
      
      // Check cache validity first
      if (cache.players?.data && Date.now() - cache.players.timestamp < CACHE_DURATION) {
        secureLog.info('Using cached players data');
        const filteredData = companyId
          ? cache.players.data.filter(player => player.company_id === companyId)
          : cache.players.data;
        return { data: filteredData, error: null };
      }
      
      // Use unique key for this request
      const requestKey = `getPlayers_${companyId || 'all'}_${Date.now()}`;
      
      return debounce(requestKey, async () => {
        const user = browserAuth.getUser();
        
        if (!user || !user.token) {
          secureLog.error('Authentication required for player data access');
          throw new Error('Authentication required');
        }

        // If user is not superadmin, force filter by their company_id
        const finalCompanyId = user.role !== 'superadmin' ? user.company_id : companyId;

        secureLog.info('Fetching player data');
        const response = await fetch(`${API_URL}/players`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch players: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache the data
        cache.players = {
          data: data,
          timestamp: Date.now()
        };
        
        // Filter by company if needed
        const filteredData = finalCompanyId
          ? data.filter(player => player.company_id === finalCompanyId)
          : data;

        secureLog.info('Players fetched successfully', { count: filteredData.length });
        return { data: filteredData, error: null };
      }, 300);
    } catch (error) {
      secureLog.error('Player data fetch error', { error: error.message });
      return { data: null, error: error.message };
    }
  },
  
  create: async (playerData) => {
    try {
      secureLog.info('Creating new player', { 
        name: playerData.name,
        company_id: playerData.company_id
      });
      
      const currentUser = browserAuth.getUser();
      
      if (!currentUser || !currentUser.token) {
        secureLog.error('Authentication required for player creation');
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
        secureLog.error('Player creation failed', { error: data.error });
        throw new Error(data.error || 'Failed to create player');
      }

      secureLog.info('Player created successfully', {
        id: data.id,
        company_id: data.company_id
      });
      
      return { data };
    } catch (error) {
      secureLog.error('Player creation error', { error: error.message });
      return { error: error.message };
    }
  },
  
  update: async (playerId, updates) => {
    try {
      secureLog.info('Updating player', { 
        playerId,
        updatedFields: Object.keys(updates)
      });
      
      const result = await fetchWithAuth(`/players/${playerId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      
      // If API call fails, update locally
      if (result.useBackup) {
        secureLog.warn('Updating player locally as backup');
        const cachedPlayers = getCachedPlayers();
        
        // Find and update the player
        const playerIndex = cachedPlayers.findIndex(p => p._id === playerId);
        if (playerIndex !== -1) {
          cachedPlayers[playerIndex] = {
            ...cachedPlayers[playerIndex],
            ...updates
          };
          storeCachedPlayers(cachedPlayers);
          return { data: cachedPlayers[playerIndex], error: null };
        }
        
        return { data: null, error: 'Player not found' };
      }
      
      // If successful, update cache
      if (result.data && !result.error) {
        const cachedPlayers = getCachedPlayers();
        const playerIndex = cachedPlayers.findIndex(p => p._id === playerId);
        if (playerIndex !== -1) {
          cachedPlayers[playerIndex] = result.data;
          storeCachedPlayers(cachedPlayers);
        }
        secureLog.info('Player updated successfully', { 
          playerId,
          updatedFields: Object.keys(updates)
        });
      }
      
      return result;
    } catch (error) {
      secureLog.error('Player update error', { 
        playerId,
        error: error.message
      });
      return { error: error.message };
    }
  },
  
  delete: async (playerId) => {
    try {
      const user = browserAuth.getUser();
      
      if (!user || !user.token) {
        secureLog.error('Authentication required for player deletion');
        throw new Error('Authentication required');
      }

      secureLog.info('Deleting player', { playerId });
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
      secureLog.info('Player deleted successfully', { playerId });
      
      return { data: { success: true }, error: null };
    } catch (error) {
      secureLog.error('Player deletion error', { error: error.message });
      return { error: error.message };
    }
  }
};

// Modified API functions with request deduplication
const userAPI = {
  getAll: async (companyId = null) => {
    try {
      const cacheKey = `users_${companyId || 'all'}`;
      
      // Check cache validity first
      if (cache.users.data && Date.now() - cache.users.timestamp < CACHE_DURATION) {
        secureLog.info('Using cached users data');
        const filteredData = companyId
          ? cache.users.data.filter(user => user.company_id === companyId)
          : cache.users.data;
        return { data: filteredData, error: null };
      }
      
      // Use unique key for this request
      const requestKey = `getUsers_${companyId || 'all'}_${Date.now()}`;
      
      return debounce(requestKey, async () => {
        try {
          const user = browserAuth.getUser();
          
          if (!user || !user.token) {
            secureLog.error('No authentication token or user found');
            throw new Error('Authentication required');
          }

          // If user is not superadmin, force filter by their company_id
          const finalCompanyId = user.role !== 'superadmin' ? user.company_id : companyId;

          const response = await fetch(`${API_URL}/users`, {
            headers: {
              'Authorization': `Bearer ${user.token}`
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.statusText}`);
          }

          const data = await response.json();
          
          // Cache the data
          cache.users = {
            data: data,
            timestamp: Date.now()
          };
          
          // Filter by company if needed
          const filteredData = finalCompanyId
            ? data.filter(user => user.company_id === finalCompanyId)
            : data;

          secureLog.info('Users fetched successfully', {
            count: filteredData.length,
            roles: filteredData.map(u => u.role)
          });

          return { data: filteredData, error: null };
        } catch (error) {
          secureLog.error('Error in userAPI.getAll:', error);
          return { data: null, error: error.message };
        }
      }, 300);
    } catch (error) {
      secureLog.error('Unexpected error in userAPI.getAll:', error);
      return { data: null, error: error.message };
    }
  },
  
  create: async (userData) => {
    const result = await fetchWithAuth('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    
    // If API call fails, store locally
    if (result.useBackup) {
      secureLog.warn('Storing user locally as backup');
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
      secureLog.info('User created successfully', { 
        id: result.data.id || result.data._id,
        role: result.data.role
      });
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
      secureLog.warn('Updating user locally as backup');
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
      secureLog.info('User updated successfully', { 
        id: userId,
        updatedFields: Object.keys(updates)
      });
    }
    
    return result;
  },

  delete: async (userId) => {
    try {
      secureLog.info('Deleting user', { userId });
      const result = await fetchWithAuth(`/users/${userId}`, {
        method: 'DELETE'
      });

      if (result.error) {
        secureLog.error('Error deleting user:', result.error);
        return { error: result.error };
      }

      // Update cache by removing the deleted user
      const cachedUsers = getCachedUsers();
      const updatedUsers = cachedUsers.filter(u => u.id !== userId && u._id !== userId);
      storeCachedUsers(updatedUsers);
      secureLog.info('User deleted successfully', { userId });

      return { data: { success: true }, error: null };
    } catch (error) {
      secureLog.error('Error deleting user:', error);
      return { error: error.message };
    }
  },
};

// API functions for authentication
const authAPI = {
  login: async (credentials) => {
    try {
      secureLog.info('Login attempt initiated');
      
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      if (!response.ok) {
        const errorData = await response.json();
        secureLog.warn('Login failed:', errorData);
        return { error: errorData.message || `Login failed: ${response.status}` };
      }

      const result = await response.json();
      
      if (result.token && result.user) {
        browserAuth.setAuth(result.token, result.refreshToken, result.user);
        secureLog.info('Login successful', { userId: result.user.id });
        initializeSession(); // Start session monitoring
      }

      return { data: result, error: null };
    } catch (error) {
      secureLog.error('Login error:', error);
      return { error: error.message || 'Failed to login' };
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
      secureLog.info('Completing registration');

      const response = await fetch(`${API_URL}/auth/complete-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`
        },
        body: JSON.stringify({
          password: data.password,
          token: data.token
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        secureLog.warn('Registration completion failed:', errorData);
        return { error: errorData.message || `Failed to complete registration: ${response.status}` };
      }

      const result = await response.json();
      
      if (result.token && result.user) {
        browserAuth.setAuth(result.token, result.user);
        secureLog.info('Registration completed successfully', { userId: result.user.id });
      }
      
      return { data: result, error: null };
    } catch (error) {
      secureLog.error('Error completing registration:', error);
      return { error: error.message || 'Failed to complete registration' };
    }
  },
  
  logout: async () => {
    if (activityCheckInterval) {
      clearInterval(activityCheckInterval);
      activityCheckInterval = null;
    }
    cleanupActivityListeners();
    browserAuth.clearAuth();
    if (ws) {
      ws.close();
      ws = null;
    }
    secureLog.info('User logged out');
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
      const user = browserAuth.getUser();
      if (!user?.token) {
        return { error: 'Authentication required' };
      }

      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (!response.ok) {
        secureLog.warn('User fetch failed', { userId, status: response.status });
        // If API call fails, use cached data
        const cachedUsers = getCachedUsers();
        const cachedUser = cachedUsers.find(u => u.id === userId);
        return { data: cachedUser || null, error: null };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      secureLog.error('User fetch error', { userId });
      // On error, try to use cached data
      const cachedUsers = getCachedUsers();
      const user = cachedUsers.find(u => u.id === userId);
      return { data: user || null, error: null };
    }
  },

  getUserByEmail: async (email) => {
    try {
      const user = browserAuth.getUser();
      if (!user?.token) {
        return { error: 'Authentication required' };
      }

      const response = await fetch(`${API_URL}/users?email=${email}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (!response.ok) {
        secureLog.warn('User fetch failed', { status: response.status });
        const cachedUsers = getCachedUsers();
        const cachedUser = cachedUsers.find(u => u.email === email);
        return { data: cachedUser || null, error: null };
      }

      const data = await response.json();
      return { data: data[0] || null, error: null };
    } catch (error) {
      secureLog.error('User fetch error');
      const cachedUsers = getCachedUsers();
      const user = cachedUsers.find(u => u.email === email);
      return { data: user || null, error: null };
    }
  },

  updateUser: async (userId, updates) => {
    try {
      const user = browserAuth.getUser();
      if (!user?.token) {
        return { error: 'Authentication required' };
      }

      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        secureLog.warn('User update failed', { userId, status: response.status });
        // If API call fails, update locally
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
      secureLog.error('User update error', { userId });
      return { data: null, error: 'Failed to update user' };
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
            secureLog.info('Using backup session data');
            return { data: { user }, error: null };
          }
          return { data: null, error: 'No session found' };
        }
      }

      return result;
    } catch (error) {
      secureLog.error(`Error in authAPI.get(${endpoint}):`, error);
      return { data: null, error: error.message };
    }
  },

  registerInvitation: async (userData) => {
    try {
      secureLog.info('Sending registration invitation');
      
      const user = browserAuth.getUser();
      
      if (!user || !user.token) {
        secureLog.error('No authentication token or user found');
        return { data: null, error: 'Authentication required' };
      }

      const result = await fetchWithAuth('/auth/register-invitation', {
        method: 'POST',
        body: JSON.stringify({
          email: userData.email,
          role: userData.role,
          company_id: userData.company_id || userData.sender_company_id,
          sender_role: userData.role,
          sender_company_id: userData.company_id || userData.sender_company_id
        })
      });

      if (result.error) {
        secureLog.warn('Registration invitation failed:', result.error);
        return { data: null, error: result.error };
      }

      secureLog.info('Registration invitation sent successfully', { userId: result.data.id });
      return result;
    } catch (error) {
      secureLog.error('Error sending registration invitation:', error);
      return { data: null, error: error.message };
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
      secureLog.info('Password update initiated');
      const user = browserAuth.getUser();
      
      if (!user?.token) {
        return { error: 'Authentication required' };
      }

      const response = await fetch(`${API_URL}/users/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

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
        secureLog.error('Password update failed', { status: response.status });
        return { error: errorData.message || 'Failed to update password' };
      }

      const data = await response.json();
      secureLog.info('Password updated successfully');
      return { data, error: null };
    } catch (error) {
      secureLog.error('Password update error');
      return { error: 'Er is een onverwachte fout opgetreden' };
    }
  },

  // 2FA Methods
  generate2FASecret: async () => {
    try {
      const result = await fetchWithAuth('/auth/2fa/generate', {
        method: 'POST'
      });

      if (result.error) {
        return { error: result.error };
      }

      if (!result.data?.secret || !result.data?.qrCode) {
        secureLog.error('Invalid 2FA secret response');
        return { error: 'Incomplete response from server' };
      }

      secureLog.info('2FA secret generated successfully');
      return {
        data: {
          secret: result.data.secret,
          qrCode: result.data.qrCode
        },
        error: null
      };
    } catch (error) {
      secureLog.error('2FA secret generation error');
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
        secureLog.warn('2FA setup verification failed');
        return { error: result.error };
      }

      secureLog.info('2FA setup verified successfully');
      return result;
    } catch (error) {
      secureLog.error('2FA setup verification error');
      return { error: 'Failed to verify 2FA setup' };
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
        secureLog.warn('2FA disable failed');
        return { error: result.error };
      }

      secureLog.info('2FA disabled successfully');
      return result;
    } catch (error) {
      secureLog.error('2FA disable error');
      return { error: 'Failed to disable 2FA' };
    }
  },

  get2FAStatus: async () => {
    try {
      const result = await fetchWithAuth('/auth/2fa/status', {
        method: 'GET'
      });

      if (result.error) {
        secureLog.warn('2FA status check failed');
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
      secureLog.error('2FA status check error');
      return { error: 'Failed to check 2FA status' };
    }
  },

  verify2FALogin: async ({ token, tempToken }) => {
    try {
      if (!token || !tempToken) {
        secureLog.error('Missing required parameters for 2FA verification');
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
      secureLog.info('2FA verification completed', { success: response.ok });

      if (!response.ok) {
        return { error: data.error || 'Verification failed' };
      }

      if (data.token && data.user) {
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
      secureLog.error('2FA verification error:', error);
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
      secureLog.error('Session check error');
      browserAuth.clearAuth();
      return { data: null, error: 'Session validation failed' };
    }
  }
};

// Export a function to manually invalidate cache
const invalidateCaches = () => {
  Object.keys(cache).forEach(key => invalidateCache(key));
};

// Add an interval to actively check token expiration
setInterval(() => {
  const user = browserAuth.getUser();
  if (user && user.token) {
    isTokenExpired(user.token);
  }
}, 30000); // Check every 30 seconds

module.exports = {
  companyAPI,
  playerAPI,
  userAPI,
  authAPI,
  invalidateCaches
};