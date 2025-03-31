const express = require('express');
const router = express.Router();
const Player = require('../models/Player');

// POST /api/player/register
router.post('/register', async (req, res) => {
    try {
        const { deviceId } = req.body;
        
        // Check if player already exists
        let player = await Player.findOne({ device_id: deviceId });
        
        if (!player) {
            // Create new player without company_id initially
            player = new Player({
                device_id: deviceId,
                company_id: 'unassigned', // Temporary value until assigned
                is_online: true,
                last_seen: new Date()
            });
            await player.save();
        } else {
            // Update existing player
            player.is_online = true;
            player.last_seen = new Date();
            await player.save();
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Player registration error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST /api/player/heartbeat
router.post('/heartbeat', async (req, res) => {
    try {
        const { player_id, status, memory_usage, cpu_usage } = req.body;
        
        // Find and update player
        const player = await Player.findOne({ device_id: player_id });
        
        if (!player) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }
        
        player.is_online = status === 'online';
        player.last_seen = new Date();
        await player.save();
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router; 