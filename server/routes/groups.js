const express = require('express');
const router = express.Router();
const Group = require('../../src/models/Group');
const Player = require('../../src/models/Player');
const { auth, authorize } = require('../../src/middleware/auth');

// Get all groups for a company
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

    const groups = await Group.find(query).sort({ createdAt: -1 }).lean();
    const groupIds = groups.map((group) => group._id);

    const playerCounts = groupIds.length > 0
      ? await Player.aggregate([
          { $match: { groups: { $in: groupIds } } },
          { $unwind: '$groups' },
          { $match: { groups: { $in: groupIds } } },
          { $group: { _id: '$groups', count: { $sum: 1 } } }
        ])
      : [];

    const countByGroupId = new Map(
      playerCounts.map((item) => [item._id.toString(), item.count])
    );

    res.json(groups.map((group) => ({
      ...group,
      playerCount: countByGroupId.get(group._id.toString()) || 0
    })));
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get group by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user has access to this group
    if (req.user.role !== 'superadmin' && group.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to access this group' });
    }

    const playerCount = await Player.countDocuments({ groups: group._id });

    res.json({ ...group.toObject(), playerCount });
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new group
router.post('/', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const { name, description, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const groupData = {
      name,
      description,
      color: color || '#1976d2',
      company_id: req.user.role === 'superadmin' ? req.body.company_id : req.user.company_id
    };

    const group = new Group(groupData);
    await group.save();

    res.status(201).json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a group
router.put('/:id', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user has access to this group
    if (req.user.role !== 'superadmin' && group.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to update this group' });
    }

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.color !== undefined) updates.color = req.body.color;

    const updatedGroup = await Group.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    res.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a group
router.delete('/:id', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user has access to this group
    if (req.user.role !== 'superadmin' && group.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to delete this group' });
    }

    // Remove group from all players
    await Player.updateMany(
      { groups: group._id },
      { $pull: { groups: group._id } }
    );

    await Group.findByIdAndDelete(req.params.id);

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add player to group
router.post('/:groupId/players/:playerId', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const { groupId, playerId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user has access to this group
    if (req.user.role !== 'superadmin' && group.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to modify this group' });
    }

    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to modify this player' });
    }

    // Add group to player if not already in group
    if (!player.groups.includes(groupId)) {
      player.groups.push(groupId);
      await player.save();
    }

    res.json({ message: 'Player added to group successfully' });
  } catch (error) {
    console.error('Error adding player to group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove player from group
router.delete('/:groupId/players/:playerId', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const { groupId, playerId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user has access to this group
    if (req.user.role !== 'superadmin' && group.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to modify this group' });
    }

    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if user has access to this player
    if (req.user.role !== 'superadmin' && player.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to modify this player' });
    }

    // Remove group from player
    player.groups = player.groups.filter(g => g.toString() !== groupId);
    await player.save();

    res.json({ message: 'Player removed from group successfully' });
  } catch (error) {
    console.error('Error removing player from group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get players in a group
router.get('/:groupId/players', auth, async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user has access to this group
    if (req.user.role !== 'superadmin' && group.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Not authorized to access this group' });
    }

    const players = await Player.find({ groups: groupId })
      .select('-screenshot.image_data')
      .lean();
    res.json(players);
  } catch (error) {
    console.error('Error fetching group players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
