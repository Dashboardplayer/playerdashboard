const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Schedule = require('../../src/models/Schedule');
const Player = require('../../src/models/Player');
const { auth, authorize } = require('../../src/middleware/auth');
const { pushScheduleUpdate } = require('../helpers/websocketHelper');
const { DEVICE_ID_PATTERN, deviceApiKeyMiddleware } = require('../middleware/deviceAuth');

const activeScheduleLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { error: 'Te veel schedule requests. Probeer het later opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Get all schedules for a player
router.get('/player/:playerId', auth, async (req, res) => {
  try {
    const { playerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: 'Invalid player id format' });
    }

    // Find player
    let player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to access this player schedules' });
    }

    // Get schedules for this player
    const schedules = await Schedule.find({ player_id: playerId, active: true }).sort({ createdAt: -1 });

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new schedule
router.post('/', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const { player_id, scheduled_url, screen_on, start_time, end_time, days_of_week, type, name } = req.body;

    // Validate required fields
    if (!player_id) {
      return res.status(400).json({ error: 'player_id is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(player_id)) {
      return res.status(400).json({ error: 'Invalid player id format' });
    }

    // Find player
    const player = await Player.findById(player_id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to create schedule for this player' });
    }

    // Validate schedule type
    if (type === 'content' && !scheduled_url) {
      return res.status(400).json({ error: 'scheduled_url is required for content schedules' });
    }

    if (type === 'screen' && (!start_time || !end_time)) {
      return res.status(400).json({ error: 'start_time and end_time are required for screen schedules' });
    }

    // Create schedule
    const schedule = new Schedule({
      player_id,
      scheduled_url: type === 'content' ? scheduled_url : null,
      screen_on: type === 'screen' ? screen_on : true,
      start_time,
      end_time,
      days_of_week: days_of_week || [0, 1, 2, 3, 4, 5, 6],
      type: type || 'content',
      name
    });

    await schedule.save();

    console.log(`✅ Schedule created for player ${player.device_id}: ${type}`);

    // Push schedule update to player via WebSocket
    await pushScheduleUpdate(player.device_id);

    res.status(201).json(schedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a schedule
router.put('/:id', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid schedule id format' });
    }

    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Check if user has access to this schedule's player
    const player = await Player.findById(schedule.player_id);
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to update this schedule' });
    }

    // Update schedule
    const updates = {};
    if (req.body.scheduled_url !== undefined) updates.scheduled_url = req.body.scheduled_url;
    if (req.body.screen_on !== undefined) updates.screen_on = req.body.screen_on;
    if (req.body.start_time !== undefined) updates.start_time = req.body.start_time;
    if (req.body.end_time !== undefined) updates.end_time = req.body.end_time;
    if (req.body.days_of_week !== undefined) updates.days_of_week = req.body.days_of_week;
    if (req.body.active !== undefined) updates.active = req.body.active;
    if (req.body.name !== undefined) updates.name = req.body.name;

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    // Push schedule update to player via WebSocket
    await pushScheduleUpdate(player.device_id);

    res.json(updatedSchedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a schedule
router.delete('/:id', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid schedule id format' });
    }

    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Check if user has access to this schedule's player
    const player = await Player.findById(schedule.player_id);
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to delete this schedule' });
    }

    await Schedule.findByIdAndDelete(req.params.id);

    // Push schedule update to player via WebSocket
    await pushScheduleUpdate(player.device_id);

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active schedule for a player
router.get('/player/:playerId/active', activeScheduleLimiter, deviceApiKeyMiddleware, async (req, res) => {
  try {
    const { playerId } = req.params;
    const { device_time, device_day } = req.query; // Optional: device local time and day

    if (!DEVICE_ID_PATTERN.test(playerId) && !mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: 'Invalid player id format' });
    }

    // Find player by device_id or _id
    let player = await Player.findOne({ device_id: playerId });
    if (!player) {
      if (mongoose.Types.ObjectId.isValid(playerId)) {
        player = await Player.findById(playerId);
      }
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get current day of week (0=Sunday, 6=Saturday)
    // Use device time if provided, otherwise use server time
    const currentDay = device_day !== undefined ? parseInt(device_day) : new Date().getDay();
    const currentTime = device_time || new Date().toTimeString().slice(0, 5); // HH:mm format

    // Find active schedules for current day
    const schedules = await Schedule.find({
      player_id: player._id,
      active: true,
      days_of_week: currentDay
    });

    // Check which schedules are currently active based on time
    const activeSchedules = schedules.filter(schedule => {
      if (!schedule.start_time || !schedule.end_time) {
        return true; // No time restriction, always active
      }

      return currentTime >= schedule.start_time && currentTime <= schedule.end_time;
    });

    // Return the first matching schedule (or default behavior)
    if (activeSchedules.length > 0) {
      const schedule = activeSchedules[0];
      
      if (schedule.type === 'screen') {
        return res.json({
          type: 'screen',
          screen_on: schedule.screen_on
        });
      } else {
        return res.json({
          type: 'content',
          url: schedule.scheduled_url
        });
      }
    }

    // No active schedule, return default
    res.json({ type: 'none' });
  } catch (error) {
    console.error('Error fetching active schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
