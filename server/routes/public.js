const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Player = require('../../src/models/Player');
const { broadcastToClients } = require('../helpers/websocketHelper');
const { DEVICE_ID_PATTERN, deviceApiKeyMiddleware } = require('../middleware/deviceAuth');

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Te veel registratieverzoeken. Probeer het later opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false
});

const toPlayerEventPayload = (player) => ({
  _id: player._id,
  device_id: player.device_id,
  unique_device_id: player.unique_device_id,
  company_id: player.company_id,
  current_url: player.current_url,
  is_online: player.is_online,
  last_seen: player.last_seen,
  createdAt: player.createdAt
});

router.post('/register-player', registerLimiter, deviceApiKeyMiddleware, async (req, res) => {
  try {
    const { device_id, unique_device_id } = req.body;
    let { company_id, name } = req.body;

    if (!device_id || !DEVICE_ID_PATTERN.test(device_id)) {
      return res.status(400).json({ error: 'Valid device ID is required' });
    }

    if (!company_id) {
      company_id = 'NOCOMPANY';
    }

    const existingPlayer = await Player.findOne({ device_id });
    if (existingPlayer) {
      console.log('Device already registered:', device_id, 'Company:', existingPlayer.company_id);
      return res.status(200).json({
        message: 'Player already registered',
        player: toPlayerEventPayload(existingPlayer)
      });
    }

    const player = new Player({
      device_id,
      unique_device_id,
      company_id,
      name: name || `Android Player - ${device_id.substring(0, 6)}`,
      current_url: req.body.current_url || '',
      is_online: true
    });

    await player.save();
    console.log('New player registered successfully:', device_id);

    broadcastToClients(JSON.stringify({
      type: 'player_created',
      data: toPlayerEventPayload(player)
    }));

    return res.status(201).json(toPlayerEventPayload(player));
  } catch (error) {
    console.error('Error registering player:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
