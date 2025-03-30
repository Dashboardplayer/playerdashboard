const admin = require('firebase-admin');

class FirebaseAdminService {
    constructor() {
        this.app = null;
        this.messaging = null;
    }

    initialize() {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
            console.log('Firebase service account not found, Firebase Admin will not be initialized');
            return;
        }

        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            this.app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });

            this.messaging = admin.messaging();
            console.log('Firebase Admin service initialized successfully');
        } catch (error) {
            console.error('Error initializing Firebase Admin:', error);
        }
    }

    async sendCommand(playerId, command) {
        if (!this.messaging) {
            throw new Error('Firebase Admin service not initialized');
        }

        try {
            const message = {
                notification: {
                    title: 'New Command',
                    body: `Command type: ${command.type}`
                },
                data: {
                    type: 'command',
                    commandId: command.id,
                    commandType: command.type,
                    payload: JSON.stringify(command.payload),
                    timestamp: command.timestamp
                },
                token: playerId // Assuming playerId is the FCM token
            };

            const response = await this.messaging.send(message);
            console.log('Successfully sent command:', response);
            return response;
        } catch (error) {
            console.error('Error sending command:', error);
            throw error;
        }
    }

    async sendNotification(playerId, notification) {
        if (!this.messaging) {
            throw new Error('Firebase Admin service not initialized');
        }

        try {
            const message = {
                notification: {
                    title: notification.title,
                    body: notification.body
                },
                token: playerId
            };

            const response = await this.messaging.send(message);
            console.log('Successfully sent notification:', response);
            return response;
        } catch (error) {
            console.error('Error sending notification:', error);
            throw error;
        }
    }

    async updatePlayerStatus(playerId, status) {
        if (!this.database) {
            throw new Error('Firebase Admin service not initialized');
        }

        const playerRef = this.database.ref(`players/${playerId}`);
        try {
            await playerRef.update({
                status,
                lastUpdated: admin.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('Error updating player status:', error);
            throw error;
        }
    }
}

module.exports = new FirebaseAdminService(); 