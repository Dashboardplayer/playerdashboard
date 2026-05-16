// WebSocket helper functions
let wss = null;

// Initialize with WebSocket server instance
const initWebSocketHelper = (websocketServer) => {
  wss = websocketServer;
};

// Function to push schedule updates to players via WebSocket
const pushScheduleUpdate = async (playerId) => {
  try {
    if (!wss) {
      console.warn('WebSocket server not initialized');
      return;
    }

    console.log(`📤 Pushing schedule update to player: ${playerId}`);

    // Find all WebSocket connections for this player
    wss.clients.forEach((client) => {
      if (client.isAuthenticated && client.isDevice && client.playerId === playerId) {
        client.send(JSON.stringify({
          type: 'schedule_update',
          timestamp: Date.now()
        }));
        console.log(`✅ Schedule update pushed to player: ${playerId}`);
      }
    });
  } catch (error) {
    console.error('Error pushing schedule update:', error);
  }
};

const broadcastToClients = (message) => {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
};

const sendToPlayer = (player, message) => {
  if (!wss || !player) {
    return false;
  }

  const playerMongoId = player._id?.toString();
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  let sent = false;

  wss.clients.forEach((client) => {
    if (
      client.readyState === 1 &&
      (
        client.playerId === player.device_id ||
        client.playerId === playerMongoId ||
        client.playerMongoId === playerMongoId
      )
    ) {
      client.send(payload);
      sent = true;
    }
  });

  return sent;
};

module.exports = {
  initWebSocketHelper,
  pushScheduleUpdate,
  broadcastToClients,
  sendToPlayer
};
