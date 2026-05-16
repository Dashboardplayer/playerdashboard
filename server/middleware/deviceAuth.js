const DEVICE_ID_PATTERN = /^[a-zA-Z0-9._:-]{3,128}$/;

const deviceApiKeyMiddleware = (req, res, next) => {
  if (!process.env.PLAYER_DEVICE_API_KEY) {
    return next();
  }

  if (req.header('x-player-api-key') !== process.env.PLAYER_DEVICE_API_KEY) {
    return res.status(401).json({ error: 'Invalid player device key' });
  }

  return next();
};

module.exports = {
  DEVICE_ID_PATTERN,
  deviceApiKeyMiddleware
};
