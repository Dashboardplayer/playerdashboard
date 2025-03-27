import * as Ably from 'ably';

class AblyService {
    constructor() {
        this.ably = null;
        this.channels = new Map();
        this.commandStatus = new Map();
        this.commandCallbacks = new Map();
    }

    initialize() {
        const apiKey = process.env.REACT_APP_ABLY_API_KEY;
        if (!apiKey) {
            throw new Error('Ably API key is required');
        }

        this.ably = new Ably.Rest(apiKey);
        console.log('Ably service initialized');
    }

    getChannel(channelName) {
        if (!this.ably) {
            throw new Error('Ably service not initialized');
        }

        if (!this.channels.has(channelName)) {
            this.channels.set(channelName, this.ably.channels.get(channelName));
        }

        return this.channels.get(channelName);
    }

    async sendCommand(playerId, command) {
        if (!this.ably) {
            throw new Error('Ably service not initialized');
        }

        const channel = this.getChannel(`player:${playerId}`);
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
            // Publish command
            await channel.publish('command', commandMessage);

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
        if (!this.ably) {
            throw new Error('Ably service not initialized');
        }

        // Subscribe to command acknowledgments
        this.ably.channels.get('command-acknowledgments').subscribe('acknowledgment', (message) => {
            const { commandId, status, error } = message.data;
            
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
        });
    }

    getCommandStatus(commandId) {
        return this.commandStatus.get(commandId);
    }

    // Helper methods for specific commands
    async updatePlayerUrl(playerId, url) {
        return this.sendCommand(playerId, {
            type: 'updateUrl',
            payload: { url }
        });
    }

    async rebootPlayer(playerId) {
        return this.sendCommand(playerId, {
            type: 'reboot',
            payload: {}
        });
    }

    async requestScreenshot(playerId) {
        return this.sendCommand(playerId, {
            type: 'screenshot',
            payload: {}
        });
    }

    async updatePlayerApp(playerId, url) {
        return this.sendCommand(playerId, {
            type: 'update',
            payload: { url }
        });
    }

    async updatePlayerSystem(playerId, url) {
        return this.sendCommand(playerId, {
            type: 'systemUpdate',
            payload: { url }
        });
    }

    subscribeToPlayer(playerId, callback) {
        const channel = this.getChannel(`player:${playerId}`);
        
        // Subscribe to all relevant events
        channel.subscribe('registration', callback);
        channel.subscribe('heartbeat', callback);
        channel.subscribe('commandAck', callback);
        channel.subscribe('screenshotStatus', callback);
    }

    unsubscribeFromPlayer(playerId) {
        const channel = this.getChannel(`player:${playerId}`);
        channel.unsubscribe();
        this.channels.delete(`player:${playerId}`);
    }

    cleanup() {
        this.channels.forEach(channel => channel.unsubscribe());
        this.channels.clear();
        if (this.ably) {
            this.ably.close();
            this.ably = null;
        }
    }
}

export const ablyService = new AblyService(); 