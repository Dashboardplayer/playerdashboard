// WebSocket connection management with enhanced error recovery
class WebSocketManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.baseReconnectDelay = 1000; // 1 second
    this.messageQueue = [];
    this.isConnecting = false;
    this.listeners = new Map();
    this.lastPingTime = null;
    this.missedPings = 0;
    this.maxMissedPings = 3;
  }

  // Initialize WebSocket connection
  async connect(token) {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      const protocols = [`jwt.${token}`];
      this.ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`, protocols);
      
      this.ws.onopen = () => this.handleOpen();
      this.ws.onclose = (event) => this.handleClose(event);
      this.ws.onerror = (error) => this.handleError(error);
      this.ws.onmessage = (event) => this.handleMessage(event);
      
      // Start heartbeat
      this.startHeartbeat();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleError(error);
    } finally {
      this.isConnecting = false;
    }
  }

  // Handle successful connection
  handleOpen() {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;
    this.processMessageQueue();
    this.emit('connected');
  }

  // Handle connection close
  handleClose(event) {
    console.log('WebSocket closed:', event.code, event.reason);
    this.cleanup();

    // Check if closure was due to token expiration or authentication failure
    if (event.code === 4401) {
      console.log('Token expired or authentication failed');
      this.handleTokenExpiration();
      return;
    }

    // Only attempt reconnect for non-authentication related closures
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  // Handle token expiration
  handleTokenExpiration() {
    // Clear local auth
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
    
    // Emit token expired event
    this.emit('tokenExpired');
    
    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/login?expired=true';
    }
  }

  // Handle errors
  handleError(error) {
    console.error('WebSocket error:', error);
    this.emit('error', error);
  }

  // Handle incoming messages
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      // Handle authentication errors
      if (message.type === 'auth_error' || message.error === 'Token expired') {
        this.handleTokenExpiration();
        return;
      }
      
      if (message.type === 'pong') {
        this.handlePong();
      } else {
        this.emit('message', message);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  // Send message with queuing for disconnected state
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.messageQueue.push(data);
      if (this.ws?.readyState === WebSocket.CLOSED) {
        this.scheduleReconnect();
      }
    }
  }

  // Process queued messages after reconnection
  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const data = this.messageQueue.shift();
      this.send(data);
    }
  }

  // Schedule reconnection with exponential backoff
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Scheduling reconnect in ${delay}ms`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  // Heartbeat mechanism
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
        this.lastPingTime = Date.now();
        this.missedPings++;

        if (this.missedPings >= this.maxMissedPings) {
          console.warn('Too many missed pings, reconnecting...');
          this.reconnect();
        }
      }
    }, 30000);
  }

  // Handle pong response
  handlePong() {
    this.missedPings = 0;
    this.lastPingTime = Date.now();
  }

  // Force reconnection
  reconnect() {
    if (this.ws) {
      this.ws.close();
    }
    this.scheduleReconnect();
  }

  // Clean up resources
  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.lastPingTime = null;
    this.missedPings = 0;
  }

  // Event handling
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  // Close connection
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
    }
    this.cleanup();
  }
}

// Create singleton instance
const wsManager = new WebSocketManager();

export default wsManager; 