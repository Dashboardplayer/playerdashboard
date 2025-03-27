import {
  userService,
  companyService,
  playerService,
  commandService,
  scheduleService,
  logService,
  updateService
} from '../services/dbService.js';
import * as authService from '../services/authService.js';
import { browserAuth } from '../utils/browserUtils.js';

// MongoDB client to handle all database operations
const mongoClient = {
  // Auth methods
  auth: {
    // Sign up a user
    signUp: async ({ email, password, role, company_id }) => {
      return await authService.registerUser(email, password, role, company_id);
    },
    
    // Reset password using email
    resetPasswordForEmail: async (email) => {
      try {
        const response = await fetch('http://localhost:5001/api/auth/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Password reset API error:', errorData);
          return { error: errorData.error || 'API error' };
        }
        
        const data = await response.json();
        return { data };
      } catch (error) {
        console.error('Password reset error:', error);
        return { error: error.message || error };
      }
    },
    
    // Sign in a user
    signInWithPassword: async ({ email, password }) => {
      const result = await authService.loginUser(email, password);
      
      if (result.error) {
        return { error: result.error };
      }
      
      // The token is already stored by browserAuth.setAuth in loginUser
      return {
        data: {
          user: result.user,
          session: {
            access_token: result.token
          }
        }
      };
    },
    
    // Sign out a user
    signOut: async () => {
      browserAuth.clearAuth();
      return { error: null };
    },
    
    // Get current session
    getSession: async () => {
      const user = browserAuth.getUser();
      
      if (!user || !user.token) {
        return { data: { session: null }, error: null };
      }
      
      const decoded = authService.verifyToken(user.token);
      
      if (!decoded) {
        browserAuth.clearAuth();
        return { data: { session: null }, error: null };
      }
      
      return { 
        data: { 
          session: { 
            access_token: user.token,
            user: { id: decoded.id }
          } 
        }, 
        error: null 
      };
    },
    
    // Get current user
    getUser: async () => {
      const user = browserAuth.getUser();
      
      if (!user || !user.token) {
        return { data: { user: null }, error: null };
      }
      
      const decoded = authService.verifyToken(user.token);
      
      if (!decoded) {
        browserAuth.clearAuth();
        return { data: { user: null }, error: null };
      }
      
      const userResult = await authService.getUserById(decoded.id);
      
      if (userResult.error) {
        return { data: { user: null }, error: userResult.error };
      }
      
      return { data: { user: userResult.user }, error: null };
    },
    
    // Auth state change listener
    onAuthStateChange: (callback) => {
      const checkAuth = async () => {
        const user = browserAuth.getUser();
        
        if (!user || !user.token) {
          callback('SIGNED_OUT', null);
          return;
        }
        
        const decoded = authService.verifyToken(user.token);
        
        if (!decoded) {
          browserAuth.clearAuth();
          callback('SIGNED_OUT', null);
          return;
        }
        
        const userResult = await authService.getUserById(decoded.id);
        
        if (userResult.error) {
          callback('SIGNED_OUT', null);
          return;
        }
        
        callback('SIGNED_IN', { 
          user: userResult.user,
          access_token: user.token
        });
      };
      
      // Check auth immediately
      checkAuth();
      
      // Set up listener for storage events
      const storageListener = (e) => {
        if (e.key === 'user') {
          checkAuth();
        }
      };
      
      window.addEventListener('storage', storageListener);
      
      return {
        subscription: {
          unsubscribe: () => {
            window.removeEventListener('storage', storageListener);
          }
        }
      };
    }
  },
  
  // Data methods
  from: (tableName) => {
    const makeQuery = () => {
      let query = {
        _filters: [],
        _select: '*',
        _single: false,
        
        // Query building methods
        select(columns) {
          query._select = columns;
          return query;
        },
        
        eq(column, value) {
          query._filters.push({ column, value, op: 'eq' });
          return query;
        },
        
        single() {
          query._single = true;
          return query;
        },
        
        // Execute methods
        async execute() {
          try {
            let service;
            switch (tableName) {
              case 'profiles':
              case 'users':
                service = userService;
                break;
              case 'companies':
                service = companyService;
                break;
              case 'players':
                service = playerService;
                break;
              case 'commands':
                service = commandService;
                break;
              case 'schedules':
                service = scheduleService;
                break;
              case 'logs':
                service = logService;
                break;
              case 'updates':
                service = updateService;
                break;
              default:
                throw new Error(`Unknown table: ${tableName}`);
            }
            
            // Handle filters
            let result;
            if (query._filters.length > 0) {
              const filter = query._filters[0]; // Currently only supporting single filter
              if (filter.column === 'id' || filter.column === '_id') {
                result = await service.getById(filter.value);
              } else if (filter.column === 'company_id') {
                result = await service.getAll(filter.value); // Pass company_id to getAll for filtering
              } else if (filter.column === 'player_id') {
                result = await service.getByPlayerId(filter.value);
              } else if (filter.column === 'email') {
                result = await service.getByEmail(filter.value);
              } else {
                result = await service.getAll();
              }
            } else {
              // For profiles/users table, use the userService.getAll() method
              if (tableName === 'profiles' || tableName === 'users') {
                result = await userService.getAll();
              } else {
                result = await service.getAll();
              }
            }
            
            if (result.error) {
              console.error(`Error executing query on ${tableName}:`, result.error);
              return { data: null, error: result.error };
            }
            
            // Ensure data is properly formatted
            const formattedData = Array.isArray(result.data) ? result.data : [result.data];
            return { 
              data: query._single ? formattedData[0] : formattedData, 
              error: null 
            };
          } catch (error) {
            console.error(`Error executing query on ${tableName}:`, error);
            return { data: null, error };
          }
        },
        
        async insert(data) {
          try {
            let service;
            switch (tableName) {
              case 'users':
                service = userService;
                break;
              case 'companies':
                service = companyService;
                break;
              case 'players':
                service = playerService;
                break;
              case 'commands':
                service = commandService;
                break;
              case 'schedules':
                service = scheduleService;
                break;
              case 'logs':
                service = logService;
                break;
              case 'updates':
                service = updateService;
                break;
              default:
                throw new Error(`Unknown table: ${tableName}`);
            }
            
            return await service.create(data);
          } catch (error) {
            console.error(`Error inserting into ${tableName}:`, error);
            return { data: null, error };
          }
        },
        
        async update(updates) {
          try {
            let service;
            switch (tableName) {
              case 'users':
                service = userService;
                break;
              case 'companies':
                service = companyService;
                break;
              case 'players':
                service = playerService;
                break;
              case 'commands':
                service = commandService;
                break;
              case 'schedules':
                service = scheduleService;
                break;
              case 'updates':
                service = updateService;
                break;
              default:
                throw new Error(`Unknown table: ${tableName}`);
            }
            
            const filter = query._filters[0]; // Currently only supporting single filter
            if (!filter || !filter.value) {
              throw new Error('Update requires an ID filter');
            }
            
            return await service.update(filter.value, updates);
          } catch (error) {
            console.error(`Error updating ${tableName}:`, error);
            return { data: null, error };
          }
        },
        
        async delete() {
          try {
            let service;
            switch (tableName) {
              case 'users':
                service = userService;
                break;
              case 'companies':
                service = companyService;
                break;
              case 'players':
                service = playerService;
                break;
              default:
                throw new Error(`Delete not supported for table: ${tableName}`);
            }
            
            const filter = query._filters[0]; // Currently only supporting single filter
            if (!filter || !filter.value) {
              throw new Error('Delete requires an ID filter');
            }
            
            return await service.delete(filter.value);
          } catch (error) {
            console.error(`Error deleting from ${tableName}:`, error);
            return { data: null, error };
          }
        }
      };
      
      // Add direct execution methods that call execute()
      return {
        ...query,
        async select(columns) {
          query.select(columns);
          return query.execute();
        },
        async single() {
          query.single();
          return query.execute();
        },
        async eq(column, value) {
          query.eq(column, value);
          return query.execute();
        }
      };
    };
    
    return makeQuery();
  },

  delete: function() {
    return {
      eq: function(field, value) {
        return new Promise((resolve) => {
          // Get the current data
          const data = JSON.parse(localStorage.getItem(this.table) || '[]');
          
          // Filter out the item to delete
          const newData = data.filter(item => item[field] !== value);
          
          // Save the updated data
          localStorage.setItem(this.table, JSON.stringify(newData));
          
          resolve({ error: null });
        });
      }
    };
  }
};

export { mongoClient };