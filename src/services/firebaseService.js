import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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

export const firebaseService = new FirebaseService(); 