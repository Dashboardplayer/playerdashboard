const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Player = require('../../src/models/Player');
const Command = require('../../src/models/Command');
const Log = require('../../src/models/Log');
const Health = require('../../src/models/Health');
const Company = require('../../src/models/Company');
const { auth, authorize } = require('../../src/middleware/auth');
const { broadcastToClients, sendToPlayer } = require('../helpers/websocketHelper');
const rateLimit = require('express-rate-limit');
const { getCached, setCached, clearCache } = require('../../src/utils/cache');
const multer = require('multer');
const { storageAdapter } = require('../../src/services/storageService');
const { DEVICE_ID_PATTERN, deviceApiKeyMiddleware } = require('../middleware/deviceAuth');

const MAX_SCREENSHOT_BASE64_BYTES = 8 * 1024 * 1024;

const uploadFolders = {
  uploads: process.env.CLOUDINARY_UPLOADS_FOLDER || 'playerdashboard/uploads',
  screenshots: process.env.CLOUDINARY_SCREENSHOTS_FOLDER || 'playerdashboard/screenshots'
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow common document and image formats
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, PowerPoint, Word, and images.'));
    }
  }
});

// Heartbeat limiter for players route
const heartbeatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 heartbeats per minute (for 5-minute interval)
  message: { error: 'Te veel heartbeat verzoeken.' },
  standardHeaders: true,
  legacyHeaders: false
});

const screenshotLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 12,
  message: { error: 'Te veel screenshot uploads. Probeer het later opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false
});

const isValidBase64Image = (value) => {
  if (typeof value !== 'string') return false;

  const base64 = value.startsWith('data:')
    ? value.split(',', 2)[1]
    : value;

  if (!base64 || base64.length > Math.ceil(MAX_SCREENSHOT_BASE64_BYTES * 4 / 3)) {
    return false;
  }

  return /^[A-Za-z0-9+/=]+$/.test(base64);
};

const toPlayerEventPayload = (player) => ({
  _id: player._id,
  device_id: player.device_id,
  unique_device_id: player.unique_device_id,
  company_id: player.company_id,
  current_url: player.current_url,
  is_online: player.is_online,
  last_seen: player.last_seen,
  createdAt: player.createdAt,
  screenshot: player.screenshot?.image_data ? {
    public_id: player.screenshot.public_id || null,
    timestamp: player.screenshot.timestamp || null,
    has_image: true
  } : undefined
});

const toPlayerListPayload = (player) => ({
  _id: player._id,
  device_id: player.device_id,
  unique_device_id: player.unique_device_id,
  company_id: player.company_id,
  current_url: player.current_url,
  is_online: player.is_online,
  last_seen: player.last_seen,
  createdAt: player.createdAt,
  groups: player.groups || [],
  screenshot: player.screenshot?.image_data ? {
    public_id: player.screenshot.public_id || null,
    timestamp: player.screenshot.timestamp || null,
    has_image: true
  } : undefined
});

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

const getPendingCommandsForPlayer = async (player) => {
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

  return normalizeCommandsForClient(commands);
};

// Get all players
router.get('/', auth, async (req, res) => {
  try {
    const query = {};
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 1), 1000);
    const skip = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = req.query.status;
    const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined || search || status;

    // If not superadmin, filter by company_id
    if (req.user.role !== 'superadmin') {
      query.company_id = req.user.company_id;
    }
    // If company_id is provided in query and user is superadmin
    else if (req.query.company_id) {
      query.company_id = req.query.company_id;
    }

    if (status === 'online') {
      query.is_online = true;
    } else if (status === 'offline') {
      query.is_online = false;
    }

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { device_id: { $regex: safeSearch, $options: 'i' } },
        { current_url: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    // Try cache first
    const cacheKey = `players_${req.user.role}_${req.user.company_id}_${req.query.company_id || 'all'}_${page}_${limit}_${search}_${status || 'all'}`;
    if (!shouldPaginate) {
      const cached = getCached(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const [players, total] = await Promise.all([
      Player.find(query)
        .sort({ last_seen: -1, createdAt: -1 })
        .skip(shouldPaginate ? skip : 0)
        .limit(shouldPaginate ? limit : 1000)
        .lean(),
      shouldPaginate ? Player.countDocuments(query) : Promise.resolve(null)
    ]);

    const payload = players.map(toPlayerListPayload);

    if (shouldPaginate) {
      return res.json({
        data: payload,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    }
    
    // Cache the result
    setCached(cacheKey, payload);
    
    res.json(payload);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const match = {};

    if (req.user.role !== 'superadmin') {
      match.company_id = req.user.company_id;
    } else if (req.query.company_id) {
      match.company_id = req.query.company_id;
    }

    const [stats] = await Player.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPlayers: { $sum: 1 },
          activePlayers: { $sum: { $cond: ['$is_online', 1, 0] } },
          offlinePlayers: { $sum: { $cond: ['$is_online', 0, 1] } }
        }
      }
    ]);

    return res.json(stats || {
      totalPlayers: 0,
      activePlayers: 0,
      offlinePlayers: 0
    });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get player by ID
router.get('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid player ID format' });
    }

    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to access this player' });
    }

    res.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get command history for a player
router.get('/:id/command-history', auth, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to access this player' });
    }

    // Fetch commands for this player, sorted by creation date (newest first)
    const commands = await Command.find({ player_id: player._id })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 commands

    console.log(`📋 Command history fetched for player ${player._id}: ${commands.length} commands`);
    res.json(commands);
  } catch (error) {
    console.error('Error fetching command history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get audit logs for a player
router.get('/:id/audit-logs', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid player ID format' });
    }

    const logs = await Log.find({ player_id: id })
      .populate('user_id', 'email name')
      .sort({ createdAt: -1 })
      .limit(3);

    return res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Create player
router.post('/', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const playerData = {
      ...req.body,
      company_id: req.user.role === 'superadmin' ? req.body.company_id : req.user.company_id,
      is_online: req.body.is_online ?? false,
      last_seen: req.body.last_seen || new Date()
    };

    const player = new Player(playerData);
    await player.save();
    
    // Clear cache for this company
    clearCache(`players_${req.user.role}_${req.user.company_id}`);

    broadcastToClients(JSON.stringify({
      type: 'player_created',
      data: toPlayerEventPayload(player)
    }));

    res.status(201).json(player);
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update player
router.put('/:id', auth, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to update this player' });
    }

    // Don't allow company_id updates unless superadmin, and never accept unknown company ids.
    if (Object.prototype.hasOwnProperty.call(req.body, 'company_id')) {
      if (req.user.role !== 'superadmin') {
        delete req.body.company_id;
      } else {
        const normalizedCompanyId = String(req.body.company_id || '').trim();
        if (normalizedCompanyId && normalizedCompanyId !== 'NOCOMPANY') {
          const companyExists = await Company.exists({ company_id: normalizedCompanyId });
          if (!companyExists) {
            return res.status(400).json({ error: 'Unknown company_id' });
          }
        }
        req.body.company_id = normalizedCompanyId;
      }
    }

    const updateData = {
      ...req.body,
      last_updated: new Date()
    };

    const updatedPlayer = await Player.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    // Clear all player list caches because company/device changes can move rows between views.
    clearCache('players_');

    try {
      if (updateData.current_url && player.current_url !== updateData.current_url) {
        await Log.create({
          user_id: req.user.id,
          player_id: req.params.id,
          action: 'url_changed',
          details: { device_id: updatedPlayer.device_id },
          old_value: { current_url: player.current_url },
          new_value: { current_url: updateData.current_url }
        });
      }

      if (updateData.device_id && player.device_id !== updateData.device_id) {
        await Log.create({
          user_id: req.user.id,
          player_id: req.params.id,
          action: 'device_id_changed',
          details: { name: updatedPlayer.name },
          old_value: { device_id: player.device_id },
          new_value: { device_id: updateData.device_id }
        });
      }

      if (updateData.company_id && player.company_id !== updateData.company_id) {
        await Log.create({
          user_id: req.user.id,
          player_id: req.params.id,
          action: 'company_changed',
          details: { device_id: updatedPlayer.device_id },
          old_value: { company_id: player.company_id },
          new_value: { company_id: updateData.company_id }
        });
      }
    } catch (logError) {
      console.error('Error creating audit log:', logError);
    }

    // Broadcast update via WebSocket
    broadcastToClients(JSON.stringify({
      type: 'player_updated',
      data: toPlayerEventPayload(updatedPlayer)
    }));

    res.json(updatedPlayer);
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete player
router.delete('/:id', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to delete this player' });
    }

    let deviceNotified = false;
    if (player.device_id) {
      const unregisterCommand = new Command({
        player_id: player._id,
        command_type: 'unregisterPlayer',
        payload: {
          reason: 'deleted_from_dashboard',
          deletedAt: new Date().toISOString()
        },
        status: 'pending',
        createdAt: new Date()
      });
      await unregisterCommand.save();

      deviceNotified = sendToPlayer(player, {
        type: 'command',
        data: {
          _id: unregisterCommand._id.toString(),
          type: 'unregisterPlayer',
          payload: unregisterCommand.payload,
          player_id: player._id.toString()
        },
        timestamp: Date.now()
      });

      if (deviceNotified) {
        unregisterCommand.status = 'delivered';
        unregisterCommand.deliveredAt = new Date();
        await unregisterCommand.save();
      }
    }

    await Promise.all([
      Command.deleteMany({ player_id: player._id }).catch((error) => {
        console.error('Error deleting player commands:', error);
      }),
      Health.deleteMany({ player_id: player._id }).catch((error) => {
        console.error('Error deleting player health data:', error);
      }),
      Log.deleteMany({ player_id: player._id }).catch((error) => {
        console.error('Error deleting player audit logs:', error);
      })
    ]);

    await Player.findByIdAndDelete(player._id);
    
    // Clear cache for this company
    clearCache(`players_${req.user.role}_${req.user.company_id}`);

    broadcastToClients(JSON.stringify({
      type: 'player_deleted',
      data: { id: req.params.id }
    }));

    res.json({
      success: true,
      deviceNotified,
      message: deviceNotified
        ? 'Player deleted and unregister command sent to device'
        : 'Player deleted. Device was not connected, so unregister command could not be delivered live.'
    });
  } catch (error) {
    console.error('Error deleting player:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send command to player
router.post('/:playerId/commands', auth, async (req, res) => {
  try {
    const { playerId } = req.params;
    const command = req.body;
    const commandType = command?.type || command?.command_type;

    // Validate command
    if (!command || !commandType) {
      return res.status(400).json({ error: 'Command type is required' });
    }

    // Find player - try by device_id first, then by _id
    const player = await findPlayerByAnyId(playerId);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to send commands to this player' });
    }

    // Create command
    const newCommand = new Command({
      player_id: player._id,
      command_type: commandType,
      payload: command.payload || {},
      status: 'pending',
      createdAt: new Date()
    });

    await newCommand.save();

    try {
      await Log.create({
        user_id: req.user.id,
        player_id: player._id,
        action: `command_${commandType}`,
        details: { device_id: player.device_id, command_id: newCommand._id },
        old_value: null,
        new_value: { command_type: commandType, payload: command.payload || {} }
      });
    } catch (logError) {
      console.error('Error creating audit log for command:', logError);
    }

    const pushed = sendToPlayer(player, {
      type: 'command',
      data: {
        _id: newCommand._id.toString(),
        type: commandType,
        payload: command.payload || {},
        player_id: player._id.toString()
      },
      timestamp: Date.now()
    });

    console.log(`Command created for player ${player.device_id}: ${commandType}`);

    res.json({
      success: true,
      pushed,
      command: {
        id: newCommand._id,
        type: commandType,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error sending command:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch pending commands for a player device (called by Android app)
router.get('/:playerId/commands', deviceApiKeyMiddleware, async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');

    const { playerId } = req.params;

    if (!DEVICE_ID_PATTERN.test(playerId) && !mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: 'Invalid player id format' });
    }

    const player = await findPlayerByAnyId(playerId, req.query.mongo_id);

    if (!player) {
      return res.json([]);
    }

    const commands = await getPendingCommandsForPlayer(player);
    return res.json(commands);
  } catch (error) {
    console.error('Error fetching pending commands:', error);
    return res.json([]);
  }
});

// Acknowledge command processing from a player device
router.post('/:playerId/commands/:commandId/acknowledge', deviceApiKeyMiddleware, async (req, res) => {
  try {
    const { playerId, commandId } = req.params;
    const { status = 'completed', result = {} } = req.body || {};

    if (!DEVICE_ID_PATTERN.test(playerId) && !mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: 'Invalid player id format' });
    }

    if (!mongoose.Types.ObjectId.isValid(commandId)) {
      return res.status(400).json({ error: 'Invalid command id format' });
    }

    if (!['completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid command status' });
    }

    const player = await findPlayerByAnyId(playerId, req.query.mongo_id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const command = await Command.findOneAndUpdate(
      { _id: commandId, player_id: player._id },
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
      return res.status(404).json({ error: 'Command not found' });
    }

    broadcastToClients(JSON.stringify({
      type: 'command_updated',
      data: command
    }));

    return res.json({ success: true, command });
  } catch (error) {
    console.error('Error acknowledging command:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Heartbeat endpoint for player devices; also returns pending commands.
router.put('/:playerId/heartbeat', heartbeatLimiter, deviceApiKeyMiddleware, async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');

    const { playerId } = req.params;

    if (!DEVICE_ID_PATTERN.test(playerId) && !mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: 'Invalid player id format' });
    }

    const player = await findPlayerByAnyId(playerId, req.body?.mongo_id);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    let changed = false;
    if (!player.is_online) {
      player.is_online = true;
      changed = true;
    }

    player.last_seen = new Date();

    if (req.body) {
      if (req.body.current_url !== undefined && player.current_url !== req.body.current_url) {
        player.current_url = req.body.current_url;
        changed = true;
      }
      // Heartbeats should not update company_id; admin changes must remain authoritative.
      if (req.body.unique_device_id !== undefined && player.unique_device_id !== req.body.unique_device_id) {
        player.unique_device_id = req.body.unique_device_id;
        changed = true;
      }
      if (req.body.battery_level !== undefined) player.battery_level = req.body.battery_level;
      if (req.body.disk_space !== undefined) player.disk_space = req.body.disk_space;
      if (req.body.deviceStats) player.deviceStats = req.body.deviceStats;
    }

    await player.save();

    if (changed) {
      broadcastToClients(JSON.stringify({
        type: 'player_updated',
        data: toPlayerEventPayload(player)
      }));
    }

    const commands = await getPendingCommandsForPlayer(player);

    return res.json({
      success: true,
      player: {
        _id: player._id.toString(),
        device_id: player.device_id,
        company_id: player.company_id,
        current_url: player.current_url,
        is_online: player.is_online
      },
      commands,
      commandCount: commands.length
    });
  } catch (error) {
    console.error('Error processing player heartbeat:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const handleScreenshotUpload = async (req, res, isV1 = false) => {
  try {
    const { playerId } = req.params;
    const { image_data, timestamp } = req.body;

    if (!DEVICE_ID_PATTERN.test(playerId) && !mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: 'Invalid player id format' });
    }

    if (!image_data) {
      return res.status(400).json({ error: 'image_data is required' });
    }

    if (!isValidBase64Image(image_data)) {
      return res.status(400).json({ error: 'Invalid or too large screenshot image' });
    }

    // Find player - try by device_id first, then by _id
    let player = await Player.findOne({ device_id: playerId });
    if (!player) {
      // Try to find by MongoDB _id
      if (mongoose.Types.ObjectId.isValid(playerId)) {
        player = await Player.findById(playerId);
      }
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const screenshotUpload = typeof storageAdapter.uploadBase64 === 'function'
      ? await storageAdapter.uploadBase64(image_data, uploadFolders.screenshots)
      : null;
    const storedImageData = screenshotUpload?.url || image_data;

    // Update player with screenshot data
    player.screenshot = {
      image_data: storedImageData,
      public_id: screenshotUpload?.publicId || null,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };
    await player.save();

    broadcastToClients(JSON.stringify({
      type: 'player_updated',
      data: toPlayerEventPayload(player)
    }));

    console.log(`📸 Screenshot uploaded for player ${player.device_id}${isV1 ? ' (v1 endpoint)' : ''}`);

    res.json({
      success: true,
      message: 'Screenshot uploaded successfully'
    });
  } catch (error) {
    console.error(`Error uploading screenshot${isV1 ? ' (v1)' : ''}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Upload screenshot from player device (no auth required - called by Android app)
router.post('/:playerId/screenshot', screenshotLimiter, deviceApiKeyMiddleware, (req, res) => handleScreenshotUpload(req, res));

// Get screenshot for a player (auth required - called by dashboard)
router.get('/:playerId/screenshot', auth, async (req, res) => {
  try {
    const { playerId } = req.params;

    // Find player - try by device_id first, then by _id
    let player = await Player.findOne({ device_id: playerId });
    if (!player) {
      // Try to find by MongoDB _id
      if (mongoose.Types.ObjectId.isValid(playerId)) {
        player = await Player.findById(playerId);
      }
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to access this player screenshot' });
    }

    // Check if screenshot exists
    if (!player.screenshot || !player.screenshot.image_data) {
      return res.status(404).json({ error: 'No screenshot available' });
    }

    res.json({
      success: true,
      screenshot: {
        image_data: player.screenshot.image_data,
        public_id: player.screenshot.public_id,
        timestamp: player.screenshot.timestamp
      }
    });
  } catch (error) {
    console.error('Error fetching screenshot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload file endpoint
router.post('/upload', auth, authorize(['superadmin', 'bedrijfsadmin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload file using storage adapter
    const { url, filename, publicId, resourceType } = await storageAdapter.upload(req.file, uploadFolders.uploads);

    res.json({
      success: true,
      url,
      filename,
      publicId,
      resourceType,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// v1 API routes for backward compatibility (screenshot endpoints)
// These mirror the non-v1 routes but are accessible via /api/v1/players/...

// Upload screenshot from player device - v1 endpoint (no auth required)
router.post('/v1/:playerId/screenshot', screenshotLimiter, deviceApiKeyMiddleware, (req, res) => handleScreenshotUpload(req, res, true));

// Get screenshot for a player - v1 endpoint (auth required)
router.get('/v1/:playerId/screenshot', auth, async (req, res) => {
  try {
    const { playerId } = req.params;

    // Find player - try by device_id first, then by _id
    let player = await Player.findOne({ device_id: playerId });
    if (!player) {
      // Try to find by MongoDB _id
      if (mongoose.Types.ObjectId.isValid(playerId)) {
        player = await Player.findById(playerId);
      }
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to access this player screenshot' });
    }

    // Check if screenshot exists
    if (!player.screenshot || !player.screenshot.image_data) {
      return res.status(404).json({ error: 'No screenshot available' });
    }

    res.json({
      success: true,
      screenshot: {
        image_data: player.screenshot.image_data,
        public_id: player.screenshot.public_id,
        timestamp: player.screenshot.timestamp
      }
    });
  } catch (error) {
    console.error('Error fetching screenshot (v1):', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
