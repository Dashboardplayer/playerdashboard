const mongoose = require('mongoose');
const Player = require('../../src/models/Player');
const Command = require('../../src/models/Command');
const { broadcastToClients, sendToPlayer } = require('../helpers/websocketHelper');

const findPlayerByAnyId = async (playerId, mongoId = null) => {
  if (mongoId && mongoose.Types.ObjectId.isValid(mongoId)) {
    const player = await Player.findById(mongoId).catch(() => null);
    if (player) return player;
  }

  if (mongoose.Types.ObjectId.isValid(playerId)) {
    const player = await Player.findById(playerId).catch(() => null);
    if (player) return player;
  }

  return Player.findOne({ device_id: playerId });
};

const normalizeCommandsForClient = (commands) => {
  return commands.map((cmd) => {
    const cmdObj = cmd.toObject();
    if (cmdObj.command_type) {
      cmdObj.type = cmdObj.command_type;
      delete cmdObj.command_type;
    }
    return cmdObj;
  });
};

const broadcastEvent = (type, data) => {
  broadcastToClients(JSON.stringify({ type, data }));
};

const handlePlayerCommand = async (ws, data = {}) => {
  try {
    const { playerId, commandType, payload = {} } = data;

    if (!playerId || !commandType) {
      ws.send(JSON.stringify({
        type: 'command_error',
        error: 'Missing playerId or commandType in command request',
        timestamp: Date.now()
      }));
      return;
    }

    const player = await findPlayerByAnyId(playerId);
    if (!player) {
      ws.send(JSON.stringify({
        type: 'command_error',
        error: `Player not found for ID: ${playerId}`,
        timestamp: Date.now()
      }));
      return;
    }

    const command = new Command({
      player_id: player._id,
      command_type: commandType,
      payload,
      status: 'pending'
    });
    await command.save();

    const pushed = sendToPlayer(player, {
      type: 'command',
      data: {
        _id: command._id.toString(),
        type: commandType,
        payload,
        player_id: player._id.toString()
      },
      timestamp: Date.now()
    });

    ws.send(JSON.stringify({
      type: 'command_success',
      data: {
        commandId: command._id.toString(),
        playerId,
        commandType,
        pushed
      },
      timestamp: Date.now()
    }));

    broadcastEvent('command_created', command);
  } catch (error) {
    console.error('Error processing WebSocket command:', error);
    ws.send(JSON.stringify({
      type: 'command_error',
      error: error.message,
      timestamp: Date.now()
    }));
  }
};

const handleRequestCommands = async (ws, data = {}) => {
  try {
    const { playerId, mongo_id } = data;

    if (!playerId) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Missing playerId in commands request',
        timestamp: Date.now()
      }));
      return;
    }

    const player = await findPlayerByAnyId(playerId, mongo_id);
    if (!player) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Player not found',
        timestamp: Date.now()
      }));
      return;
    }

    const commands = await Command.find({
      player_id: player._id,
      status: 'pending'
    }).sort({ createdAt: 1 });

    if (commands.length > 0) {
      await Command.updateMany(
        { _id: { $in: commands.map((cmd) => cmd._id) } },
        { $set: { status: 'delivered', deliveredAt: new Date() } }
      );
    }

    ws.playerId = playerId;
    ws.playerMongoId = player._id.toString();

    ws.send(JSON.stringify({
      type: 'commands',
      data: normalizeCommandsForClient(commands),
      count: commands.length,
      timestamp: Date.now()
    }));

    player.is_online = true;
    player.last_seen = new Date();
    await player.save();
  } catch (error) {
    console.error('Error fetching commands for player:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message,
      timestamp: Date.now()
    }));
  }
};

const handleCommandAcknowledgment = async (ws, data = {}) => {
  try {
    const { commandId, status = 'completed', result = {} } = data;

    if (!commandId) {
      console.error('Missing commandId in acknowledgment');
      return;
    }

    const command = await Command.findByIdAndUpdate(
      commandId,
      {
        $set: {
          status,
          result,
          completedAt: new Date()
        }
      },
      { new: true }
    );

    if (!command) {
      console.error(`Command not found for ID: ${commandId}`);
      return;
    }

    broadcastEvent('command_updated', command);
  } catch (error) {
    console.error('Error processing command acknowledgment:', error);
  }
};

const updatePlayerOnlineStatus = async (playerId) => {
  try {
    if (!playerId) {
      console.warn('Called updatePlayerOnlineStatus with empty playerId');
      return;
    }

    const player = await findPlayerByAnyId(playerId);
    if (!player) {
      console.warn(`Player not found for ID: ${playerId} when updating online status`);
      return;
    }

    player.is_online = true;
    player.last_seen = new Date();
    await player.save();
    broadcastEvent('player_updated', player);
  } catch (error) {
    console.error(`Error updating online status for player ${playerId}:`, error);
  }
};

module.exports = {
  handlePlayerCommand,
  handleRequestCommands,
  handleCommandAcknowledgment,
  updatePlayerOnlineStatus
};
