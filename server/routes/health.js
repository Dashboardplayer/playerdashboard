const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Health = require('../../src/models/Health');
const Player = require('../../src/models/Player');
const { auth } = require('../../src/middleware/auth');
const { DEVICE_ID_PATTERN, deviceApiKeyMiddleware } = require('../middleware/deviceAuth');

const PLAYER_OFFLINE_THRESHOLD_MS = 7 * 60 * 1000;

const healthSubmitLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'Te veel health requests. Probeer het later opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false
});

const findPlayerByAnyId = async (playerId) => {
  if (!DEVICE_ID_PATTERN.test(playerId) && !mongoose.Types.ObjectId.isValid(playerId)) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(playerId)) {
    const player = await Player.findById(playerId).catch(() => null);
    if (player) return player;
  }

  return Player.findOne({ device_id: playerId });
};

// Submit health data from player
router.post('/submit', healthSubmitLimiter, deviceApiKeyMiddleware, async (req, res) => {
  try {
    const {
      player_id,
      cpu_usage,
      memory_usage,
      storage_usage,
      storage_total,
      storage_free,
      uptime,
      battery_level,
      battery_charging,
      temperature,
      network_type,
      network_strength,
      app_version,
      android_version
    } = req.body;

    if (!player_id || (!DEVICE_ID_PATTERN.test(player_id) && !mongoose.Types.ObjectId.isValid(player_id))) {
      return res.status(400).json({ error: 'Invalid player id format' });
    }

    const player = await findPlayerByAnyId(player_id);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const healthData = new Health({
      player_id: player._id,
      cpu_usage,
      memory_usage,
      storage_usage,
      storage_total,
      storage_free,
      uptime,
      battery_level,
      battery_charging,
      temperature,
      network_type,
      network_strength,
      app_version,
      android_version
    });

    await healthData.save();

    // TTL index automatically deletes records older than 7 days for scalability
    res.status(201).json({ message: 'Health data recorded successfully' });
  } catch (error) {
    console.error('Error recording health data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get latest health data for a player
router.get('/player/:playerId', auth, async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await findPlayerByAnyId(playerId);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to access this player health data' });
    }

    // Get latest health data
    const health = await Health.findOne({ player_id: player._id })
      .sort({ createdAt: -1 });

    if (!health) {
      return res.status(404).json({ error: 'No health data available' });
    }

    res.json(health);
  } catch (error) {
    console.error('Error fetching health data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get health history for a player
router.get('/player/:playerId/history', auth, async (req, res) => {
  try {
    const { playerId } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

    const player = await findPlayerByAnyId(playerId);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to access this player health data' });
    }

    // Get health history
    const healthHistory = await Health.find({ player_id: player._id })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(healthHistory);
  } catch (error) {
    console.error('Error fetching health history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get health summary for all players (admin only)
router.get('/summary', auth, async (req, res) => {
  try {
    const query = {};

    // If not superadmin, filter by company_id
    if (req.user.role !== 'superadmin') {
      // Get all players for this company
      const players = await Player.find({ company_id: req.user.company_id }).select('_id');
      const playerIds = players.map(p => p._id);
      query.player_id = { $in: playerIds };
    }

    // Get latest health data for each player
    const healthData = await Health.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $group: {
        _id: '$player_id',
        latest: { $first: '$$ROOT' }
      }},
      { $replaceRoot: { newRoot: '$latest' } }
    ]);

    // Populate player info
    const populatedHealth = await Health.populate(healthData, { path: 'player_id' });

    res.json(populatedHealth);
  } catch (error) {
    console.error('Error fetching health summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get offline players using the same inactivity threshold as the player activity monitor.
router.get('/offline', auth, async (req, res) => {
  try {
    const offlineThreshold = new Date(Date.now() - PLAYER_OFFLINE_THRESHOLD_MS);

    const query = {
      $or: [
        { is_online: false },
        { last_seen: { $lt: offlineThreshold } },
        { last_seen: { $exists: false } }
      ]
    };

    // If not superadmin, filter by company_id
    if (req.user.role !== 'superadmin') {
      query.company_id = req.user.company_id;
    }

    // Get players with no recent heartbeat
    const offlinePlayers = await Player.find(query);

    res.json(offlinePlayers);
  } catch (error) {
    console.error('Error fetching offline players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
