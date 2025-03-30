const express = require('express');
const router = express.Router();
const { auth } = require('../../src/middleware/auth');
const firebaseAdmin = require('../services/firebaseAdmin');

// Send command to player
router.post('/', auth, async (req, res) => {
    try {
        const { playerId, command } = req.body;
        
        if (!playerId || !command) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await firebaseAdmin.sendCommand(playerId, command);
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending command:', error);
        res.status(500).json({ error: 'Failed to send command' });
    }
});

module.exports = router; 