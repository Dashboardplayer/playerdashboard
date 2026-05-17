const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { WebSocket, WebSocketServer } = require('ws');
const User = require('../../src/models/User');
const Player = require('../../src/models/Player');
const { isTokenBlacklisted } = require('../../src/services/tokenBlacklistService');
const { secureLog } = require('../../src/utils/secureLogger');
const { initWebSocketHelper } = require('../helpers/websocketHelper');
const {
  handlePlayerCommand,
  handleRequestCommands,
  handleCommandAcknowledgment,
  updatePlayerOnlineStatus
} = require('../handlers/websocketCommandHandlers');

const PING_INTERVAL = 30000;
const PING_TIMEOUT = 5000;
const TOKEN_VERIFICATION_INTERVAL = 60000;

function setupWebSocketServer(server) {
  const wss = new WebSocketServer({
    noServer: true,
    clientTracking: true,
    maxPayload: 10 * 1024 * 1024,
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      threshold: 1024
    },
    pingInterval: 30000,
    pingTimeout: 60000
  });

  initWebSocketHelper(wss);

  const pendingUpdates = new Map();

  const broadcastToDashboardClients = (message) => {
    wss.clients.forEach((client) => {
      if (!client.user) return;

      if (client.user.role !== 'superadmin') {
        const data = JSON.parse(message).data;

        if (message.startsWith('company_')) {
          return;
        }

        if (message.startsWith('player_') && data.company_id !== client.user.company_id) {
          return;
        }
      }

      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  const broadcastEvent = (eventType, data) => {
    if (!eventType.startsWith('player_') || eventType === 'player_updated') {
      broadcastToDashboardClients(JSON.stringify({ type: eventType, data }));
      return;
    }

    const playerId = data.id || data._id;
    if (!playerId) return;

    if (!pendingUpdates.has(playerId)) {
      pendingUpdates.set(playerId, { data, timestamp: Date.now() });

      setTimeout(() => {
        const update = pendingUpdates.get(playerId);
        if (!update) return;

        broadcastToDashboardClients(JSON.stringify({
          type: eventType,
          data: update.data,
          batchTimestamp: Date.now()
        }));
        pendingUpdates.delete(playerId);
      }, 1000);
    } else {
      const existing = pendingUpdates.get(playerId);
      pendingUpdates.set(playerId, {
        data: { ...existing.data, ...data },
        timestamp: Date.now()
      });
    }
  };

  const verifyAndRefreshTokens = () => {
    wss.clients.forEach((client) => {
      if (!client.user || !client.user.token) return;

      try {
        const decoded = jwt.verify(client.user.token, process.env.JWT_SECRET, {
          ignoreExpiration: true
        });

        const timeUntilExpiry = decoded.exp * 1000 - Date.now();
        if (timeUntilExpiry < 5 * 60 * 1000) {
          client.send(JSON.stringify({
            type: 'token_refresh_required',
            message: 'Your session is expiring soon'
          }));
        }
      } catch (error) {
        secureLog.warn('WebSocket token invalid, closing connection', {
          ip: client._socket.remoteAddress
        });
        client.close(4401, 'Token expired or invalid');
      }
    });
  };

  const handleAuthentication = async (ws, message) => {
    try {
      if (message.clientId && !message.token) {
        let player = null;
        if (message.mongo_id && mongoose.Types.ObjectId.isValid(message.mongo_id)) {
          player = await Player.findById(message.mongo_id).catch(() => null);
          if (player && player.device_id !== message.clientId) {
            console.log(`WebSocket: Found player by mongo_id, updating device_id from ${player.device_id} to ${message.clientId}`);
            player.device_id = message.clientId;
            await player.save();
          }
        }

        if (!player) {
          player = await Player.findOne({ device_id: message.clientId });
        }

        if (!player) {
          console.log('Device authentication failed: Player not found for deviceId:', message.clientId);
          ws.send(JSON.stringify({ type: 'auth_error', error: 'Player not found' }));
          ws.close(4401, 'Player not found');
          return;
        }

        ws.playerId = player.device_id;
        ws.playerMongoId = player._id.toString();
        ws.isAuthenticated = true;
        ws.isDevice = true;

        console.log('WebSocket authenticated via device for playerId:', player.device_id);
        ws.send(JSON.stringify({ type: 'auth_success', timestamp: Date.now() }));
        return;
      }

      if (message.token) {
        const decoded = jwt.verify(message.token, process.env.JWT_SECRET, {
          algorithms: ['HS256'],
          audience: 'player-dashboard-api',
          issuer: 'player-dashboard'
        });

        const isBlacklisted = await isTokenBlacklisted(decoded.jti);
        if (isBlacklisted) {
          console.log('Token blacklisted, closing connection');
          ws.close(4401, 'Token has been revoked');
          return;
        }

        const user = await User.findById(decoded.sub);
        if (!user || user.role !== decoded.role) {
          console.log('User changed or deleted, closing connection');
          ws.close(4401, 'User authentication invalid');
          return;
        }

        ws.clientId = message.clientId;
        ws.isAuthenticated = true;
        ws.isDevice = false;
        secureLog.info('WebSocket authenticated via message', { userId: decoded.sub });
        ws.send(JSON.stringify({ type: 'auth_success', timestamp: Date.now() }));
        return;
      }

      console.log('WebSocket authentication failed: No token or clientId provided');
      ws.send(JSON.stringify({
        type: 'auth_error',
        error: 'No authentication credentials provided'
      }));
      ws.close(4401, 'Authentication failed');
    } catch (error) {
      console.log('WebSocket message authentication failed:', error.message);
      ws.send(JSON.stringify({
        type: 'auth_error',
        error: error.message
      }));
      ws.close(4401, 'Authentication failed');
    }
  };

  const handleUrlUpdate = async (ws, data) => {
    try {
      if (!ws.isAuthenticated) {
        ws.close(4401, 'Not authenticated');
        return;
      }

      const { playerId, url } = data;
      const updatedPlayer = await Player.findByIdAndUpdate(
        playerId,
        { $set: { current_url: url, last_updated: new Date() } },
        { new: true }
      );

      if (!updatedPlayer) {
        console.error('Player not found for URL update:', playerId);
        return;
      }

      broadcastToDashboardClients(JSON.stringify({
        type: 'url_update',
        data: {
          id: playerId,
          current_url: url,
          timestamp: Date.now()
        }
      }));

      console.log(`URL updated successfully for player ${playerId} to ${url}`);
    } catch (error) {
      console.error('Error handling URL update:', error);
    }
  };

  server.on('upgrade', function upgrade(request, socket, head) {
    console.log('WebSocket upgrade request received', request.url);

    if (request.url !== '/api') {
      console.log('WebSocket connection rejected: Invalid path', request.url);
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      let token = null;
      const protocols = request.headers['sec-websocket-protocol'];

      if (protocols) {
        const jwtProtocol = protocols.split(', ').find((p) => p.startsWith('jwt.'));
        if (jwtProtocol) {
          token = jwtProtocol.substring(4);
        }
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            audience: 'player-dashboard-api',
            issuer: 'player-dashboard'
          });

          if (!decoded.sub || !decoded.email || !decoded.role) {
            console.log('WebSocket token missing required claims');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          request.user = {
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role,
            company_id: decoded.company_id,
            token
          };

          secureLog.info('WebSocket authenticated for dashboard user', { userId: decoded.sub });

          wss.handleUpgrade(request, socket, head, function done(ws) {
            ws.user = request.user;
            ws.isAuthenticated = true;
            wss.emit('connection', ws, request);
          });
        } catch (error) {
          console.log('WebSocket token verification failed:', error.message);
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
        }
      } else {
        console.log('WebSocket connection allowed without token (device authentication expected)');
        wss.handleUpgrade(request, socket, head, function done(ws) {
          ws.isAuthenticated = false;
          wss.emit('connection', ws, request);
        });
      }
    } catch (error) {
      console.error('WebSocket upgrade error:', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('listening', () => {
    console.log('WebSocket server is listening');
  });

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  wss.on('headers', (headers) => {
    headers.push('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    headers.push('X-Content-Type-Options: nosniff');
    headers.push('X-XSS-Protection: 1; mode=block');
    headers.push('X-Frame-Options: DENY');
  });

  setInterval(verifyAndRefreshTokens, TOKEN_VERIFICATION_INTERVAL);

  wss.on('connection', function connection(ws) {
    console.log('New WebSocket connection established');
    ws.isAlive = true;
    ws.pingTimeout = null;

    const pingInterval = setInterval(() => {
      if (!ws.isAlive) {
        clearInterval(pingInterval);
        clearTimeout(ws.pingTimeout);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
      ws.pingTimeout = setTimeout(() => {
        ws.terminate();
      }, PING_TIMEOUT);
    }, PING_INTERVAL);

    ws.on('pong', () => {
      ws.isAlive = true;
      clearTimeout(ws.pingTimeout);
    });

    ws.on('message', (message) => {
      try {
        let parsedMessage;
        try {
          parsedMessage = JSON.parse(typeof message === 'string' ? message : message.toString());
        } catch (parseError) {
          console.warn('Failed to parse WebSocket message:', message.toString());
          return;
        }

        switch (parsedMessage.type) {
          case 'player_created':
          case 'player_updated':
          case 'player_deleted':
            if (!parsedMessage.data) {
              console.warn('Missing data for operation:', parsedMessage.type);
              return;
            }
            broadcastEvent(parsedMessage.type, parsedMessage.data);
            break;

          case 'authenticate':
            handleAuthentication(ws, parsedMessage);
            break;

          case 'request_commands':
            handleRequestCommands(ws, parsedMessage);
            break;

          case 'command':
            handlePlayerCommand(ws, parsedMessage.data);
            break;

          case 'command_ack':
            handleCommandAcknowledgment(ws, parsedMessage);
            break;

          case 'pong':
            ws.isAlive = true;
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            ws.isAlive = true;
            break;

          case 'heartbeat':
            ws.send(JSON.stringify({ type: 'heartbeat_ack', timestamp: Date.now() }));
            ws.isAlive = true;
            if (ws.playerMongoId) {
              updatePlayerOnlineStatus(ws.playerMongoId);
            } else if (ws.playerId) {
              updatePlayerOnlineStatus(ws.playerId);
            }
            break;

          case 'url_update':
            handleUrlUpdate(ws, parsedMessage.data);
            break;

          default:
            console.warn('Unknown message type:', parsedMessage.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      clearTimeout(ws.pingTimeout);
    });
  });

  return wss;
}

module.exports = { setupWebSocketServer };
