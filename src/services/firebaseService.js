import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Import circuit breaker with a fallback
let circuitBreaker;
try {
  circuitBreaker = require('./circuitBreakerService');
} catch (error) {
  console.error('Failed to import circuit breaker:', error);
  // Create a dummy implementation that passes through calls
  circuitBreaker = {
    registerService: () => {},
    exec: (serviceName, fn, ...args) => fn(...args)
  };
}

class FirebaseService {
    constructor() {
        this.app = null;
        this.messaging = null;
        this.commandStatus = new Map();
        this.commandCallbacks = new Map();
        this.fcmToken = null;
    }

    async initialize() {
        const firebaseConfig = {
            apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
            authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
            storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.REACT_APP_FIREBASE_APP_ID,
            measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
        };

        if (!firebaseConfig.apiKey) {
            throw new Error('Firebase configuration is required');
        }

        this.app = initializeApp(firebaseConfig);
        this.messaging = getMessaging(this.app);

        try {
            // Request permission and get FCM token
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.fcmToken = await getToken(this.messaging, {
                    vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY
                });
                console.log('FCM Token:', this.fcmToken);
            }

            // Handle foreground messages
            onMessage(this.messaging, (payload) => {
                console.log('Received foreground message:', payload);
                // Handle the message as needed
                if (payload.data && payload.data.commandId) {
                    const { commandId, status, error } = payload.data;
                    this.handleCommandUpdate(commandId, status, error);
                }
            });

            console.log('Firebase service initialized');
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            throw error;
        }
    }

    async sendCommand(playerId, command) {
        if (!this.messaging) {
            throw new Error('Firebase service not initialized');
        }

        const commandId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Create command object with metadata
        const commandMessage = {
            id: commandId,
            type: command.type,
            payload: command.payload,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        try {
            // Send command via API endpoint that will use Firebase Admin SDK
            const response = await fetch('/api/commands', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerId,
                    command: commandMessage
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send command');
            }

            // Set up command status tracking
            this.commandStatus.set(commandId, {
                status: 'pending',
                timestamp: new Date(),
                retries: 0
            });

            // Set up acknowledgment timeout
            this.setupCommandTimeout(commandId);

            return commandId;
        } catch (error) {
            console.error('Error sending command:', error);
            this.commandStatus.set(commandId, {
                status: 'failed',
                error: error.message,
                timestamp: new Date()
            });
            throw error;
        }
    }

    setupCommandTimeout(commandId) {
        // Set timeout for command acknowledgment (30 seconds)
        const timeout = setTimeout(() => {
            const status = this.commandStatus.get(commandId);
            if (status && status.status === 'pending') {
                status.status = 'timeout';
                status.error = 'Command acknowledgment timeout';
                this.commandStatus.set(commandId, status);

                // Trigger callback if exists
                const callback = this.commandCallbacks.get(commandId);
                if (callback) {
                    callback(status);
                }
            }
        }, 30000);

        // Store timeout reference
        this.commandCallbacks.set(commandId, (status) => {
            clearTimeout(timeout);
            this.commandCallbacks.delete(commandId);
        });
    }

    onCommandAcknowledgment(callback) {
        if (!this.messaging) {
            throw new Error('Firebase service not initialized');
        }

        // Set up WebSocket connection for command acknowledgments
        const ws = new WebSocket(`ws://${window.location.host}/ws/commands`);
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const { commandId, status, error } = data;
            
            // Update command status
            this.commandStatus.set(commandId, {
                status,
                timestamp: new Date(),
                error
            });

            // Trigger callback if exists
            const commandCallback = this.commandCallbacks.get(commandId);
            if (commandCallback) {
                commandCallback(this.commandStatus.get(commandId));
            }

            // Call the provided callback
            callback({
                commandId,
                status,
                error,
                timestamp: new Date()
            });
        };

        // Store WebSocket connection for cleanup
        this.commandCallbacks.set('ws', ws);
    }

    async updatePlayerSystem(playerId, url) {
        return this.sendCommand(playerId, {
            type: 'systemUpdate',
            payload: { url }
        });
    }

    subscribeToPlayer(playerId, callback) {
        if (!this.messaging) {
            throw new Error('Firebase service not initialized');
        }

        // Set up WebSocket connection for player events
        const ws = new WebSocket(`ws://${window.location.host}/ws/players/${playerId}`);
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            callback({
                type: data.type,
                data: data.payload,
                timestamp: data.timestamp
            });
        };

        // Store WebSocket connection for cleanup
        this.commandCallbacks.set(`player:${playerId}`, ws);
    }

    unsubscribeFromPlayer(playerId) {
        const ws = this.commandCallbacks.get(`player:${playerId}`);
        if (ws) {
            ws.close();
            this.commandCallbacks.delete(`player:${playerId}`);
        }
    }

    cleanup() {
        // Close all WebSocket connections
        this.commandCallbacks.forEach((ws, key) => {
            if (ws instanceof WebSocket) {
                ws.close();
            }
        });
        this.commandCallbacks.clear();
    }
}

// Storage for failed notifications in server context
const failedNotificationQueue = [];

// Define the sendNotification function before using it with circuit breaker
let sendNotification = async (tokens, notification) => {
  try {
    if (!tokens || tokens.length === 0) {
      console.warn('No tokens provided for notification');
      return { success: false, error: 'No tokens provided' };
    }

    // Create the notification payload
    const payload = {
      tokens,
      notification: {
        title: notification.title || 'Display Beheer',
        body: notification.body || '',
        ...notification
      },
      data: notification.data || {}
    };

    // Use different methods to send notifications based on environment
    if (typeof window !== 'undefined') {
      // Browser environment: use fetch API
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to send notification: ${response.statusText}`);
      }

      const result = await response.json();
      return { success: true, result };
    } else {
      // Server environment: use Firebase Admin SDK directly
      // This requires setting up the Firebase Admin SDK in the server code
      console.log('Server-side notification sending: would use Firebase Admin SDK');
      return { success: true, result: { serverSide: true } };
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

// Register Firebase services with the circuit breaker
circuitBreaker.registerService('firebase-messaging', {
  failureThreshold: 3,
  resetTimeout: 60000, // 1 minute
  fallbackFn: async (tokens, notification) => {
    console.error(`Firebase messaging service unavailable. Would have sent to ${tokens.length} devices`);
    // Store failed notifications for retry
    try {
      if (typeof window !== 'undefined') {
        // Browser environment: use localStorage
        const failedNotifications = JSON.parse(localStorage.getItem('failedNotifications') || '[]');
        failedNotifications.push({ tokens, notification, timestamp: Date.now() });
        localStorage.setItem('failedNotifications', JSON.stringify(failedNotifications));
      } else {
        // Server environment: use in-memory array
        failedNotificationQueue.push({ tokens, notification, timestamp: Date.now() });
      }
    } catch (error) {
      console.error('Failed to store notification for retry:', error);
    }
    return { status: 'queued_for_retry' };
  },
  healthCheckFn: async () => {
    // Simple check if Firebase config is available
    try {
      const config = {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID
      };
      return !!(config.apiKey && config.authDomain && config.projectId);
    } catch (error) {
      return false;
    }
  }
});

// Wrap the existing sendNotification function with circuit breaker
const originalSendNotification = sendNotification;
sendNotification = async (tokens, notification) => {
  return circuitBreaker.exec('firebase-messaging', originalSendNotification, tokens, notification);
};

// Add a function to retry failed notifications
const retryFailedNotifications = async () => {
  try {
    let failedNotifications = [];
    let newFailedNotifications = [];
    
    // Get failed notifications from the appropriate storage
    if (typeof window !== 'undefined') {
      // Browser environment: use localStorage
      failedNotifications = JSON.parse(localStorage.getItem('failedNotifications') || '[]');
    } else {
      // Server environment: use in-memory array
      failedNotifications = [...failedNotificationQueue];
      // Clear the queue as we'll repopulate it with notifications that still need to be retried
      failedNotificationQueue.length = 0;
    }
    
    if (failedNotifications.length === 0) return;
    
    console.log(`Attempting to retry ${failedNotifications.length} failed notifications`);
    
    const retryResults = [];
    
    for (const notification of failedNotifications) {
      try {
        // Only retry notifications that are at least 1 minute old
        if (Date.now() - notification.timestamp < 60000) {
          newFailedNotifications.push(notification);
          continue;
        }
        
        // Check circuit breaker status
        const status = circuitBreaker.getStatus('firebase-messaging');
        if (status && status.state === 'OPEN') {
          newFailedNotifications.push(notification);
          continue;
        }
        
        // Try to send the notification
        const result = await originalSendNotification(notification.tokens, notification.notification);
        retryResults.push({ notification, result, success: true });
      } catch (error) {
        console.error(`Failed to retry notification:`, error);
        // Update timestamp and keep in queue
        notification.timestamp = Date.now();
        newFailedNotifications.push(notification);
        retryResults.push({ notification, error: error.message, success: false });
      }
    }
    
    // Update the storage with notifications that still need to be retried
    if (typeof window !== 'undefined') {
      // Browser environment: use localStorage
      localStorage.setItem('failedNotifications', JSON.stringify(newFailedNotifications));
    } else {
      // Server environment: use in-memory array
      failedNotificationQueue.push(...newFailedNotifications);
    }
    
    console.log(`Notification retry complete. ${retryResults.filter(r => r.success).length} succeeded, ${newFailedNotifications.length} still pending.`);
    
    return retryResults;
  } catch (error) {
    console.error('Error retrying failed notifications:', error);
    return [];
  }
};

// Set up periodic retries
setInterval(retryFailedNotifications, 5 * 60 * 1000); // Every 5 minutes

export const firebaseService = new FirebaseService(); 