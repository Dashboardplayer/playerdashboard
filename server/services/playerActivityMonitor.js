const Player = require('../../src/models/Player');
const { secureLog } = require('../../src/utils/secureLogger');
const { broadcastToClients } = require('../helpers/websocketHelper');

const PLAYER_OFFLINE_THRESHOLD = 7 * 60 * 1000;

const startPlayerActivityMonitor = () => {
  const checkOfflinePlayers = async () => {
    try {
      const offlineThreshold = new Date(Date.now() - PLAYER_OFFLINE_THRESHOLD);
      const inactivePlayers = await Player.find({
        is_online: true,
        last_seen: { $lt: offlineThreshold }
      });

      if (inactivePlayers.length === 0) {
        return;
      }

      secureLog.info(`Marking ${inactivePlayers.length} inactive players as offline`);

      await Promise.all(inactivePlayers.map((player) => {
        player.is_online = false;
        return player.save();
      }));

      inactivePlayers.forEach((player) => {
        broadcastToClients(JSON.stringify({
          type: 'player_updated',
          data: player
        }));
      });
    } catch (error) {
      secureLog.error('Error checking for inactive players:', error);
    }
  };

  return setInterval(checkOfflinePlayers, 60 * 1000);
};

module.exports = { startPlayerActivityMonitor };
