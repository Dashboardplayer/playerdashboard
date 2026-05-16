const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Player = require('../../src/models/Player');
const { broadcastToClients } = require('../helpers/websocketHelper');
const { DEVICE_ID_PATTERN, deviceApiKeyMiddleware } = require('../middleware/deviceAuth');

const createPlayerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Te veel registratieverzoeken. Probeer het later opnieuw.',
  standardHeaders: true,
  legacyHeaders: false
});

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const toPlayerEventPayload = (player) => ({
  _id: player._id,
  device_id: player.device_id,
  company_id: player.company_id,
  current_url: player.current_url,
  is_online: player.is_online,
  last_seen: player.last_seen,
  createdAt: player.createdAt
});

router.post('/create-player', createPlayerLimiter, deviceApiKeyMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.body;
    let { companyId, name } = req.body;

    if (!deviceId || !DEVICE_ID_PATTERN.test(deviceId)) {
      return res.status(400).send('Device ID is required');
    }

    if (!companyId) {
      companyId = 'NOCOMPANY';
    }

    const existingPlayer = await Player.findOne({ device_id: deviceId });
    if (existingPlayer) {
      console.log('Device already registered via form:', deviceId);
      return res.status(200).send(`
        <html>
          <head><title>Player Already Registered</title></head>
          <body>
            <h1>Player Already Registered</h1>
            <p>Player with device ID "${escapeHtml(deviceId)}" is already registered.</p>
            <p><a href="/">Return to Dashboard</a></p>
          </body>
        </html>
      `);
    }

    const player = new Player({
      device_id: deviceId,
      company_id: companyId,
      name: name || `Player - ${deviceId.substring(0, 6)}`,
      current_url: req.body.currentUrl || '',
      is_online: req.body.isOnline === 'true'
    });

    await player.save();
    console.log('New player created via form:', deviceId);

    broadcastToClients(JSON.stringify({
      type: 'player_created',
      data: toPlayerEventPayload(player)
    }));

    return res.status(201).send(`
      <html>
        <head><title>Player Created</title></head>
        <body>
          <h1>Player Created Successfully</h1>
          <p>Player with device ID "${escapeHtml(deviceId)}" has been registered.</p>
          <p><a href="/">Return to Dashboard</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error creating player from form:', error);
    return res.status(500).send(`Error: ${error.message}`);
  }
});

module.exports = router;
