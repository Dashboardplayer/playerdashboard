const express = require('express');
const router = express.Router();
const Player = require('../../src/models/Player');
const { auth, authorize } = require('../../src/middleware/auth');

// Get all players
router.get('/', auth, async (req, res) => {
  try {
    const query = {};
    
    // If not superadmin, filter by company_id
    if (req.user.role !== 'superadmin') {
      query.company_id = req.user.company_id;
    }
    // If company_id is provided in query and user is superadmin
    else if (req.query.company_id) {
      query.company_id = req.query.company_id;
    }

    const players = await Player.find(query);
    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get player by ID
router.get('/:id', auth, async (req, res) => {
  try {
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

// Create player
router.post('/', auth, async (req, res) => {
  try {
    const playerData = {
      ...req.body,
      company_id: req.user.role === 'superadmin' ? req.body.company_id : req.user.company_id
    };

    const player = new Player(playerData);
    await player.save();
    res.status(201).json(player);
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: 'Internal server error' });
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

    // Don't allow company_id updates unless superadmin
    if (req.body.company_id && req.user.role !== 'superadmin') {
      delete req.body.company_id;
    }

    const updatedPlayer = await Player.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    res.json(updatedPlayer);
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete player
router.delete('/:id', auth, async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to delete this player' });
    }

    await Player.findByIdAndDelete(req.params.id);
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    console.error('Error deleting player:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 