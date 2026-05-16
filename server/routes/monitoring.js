const express = require('express');
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const Player = require('../../src/models/Player');
const { auth, authorize } = require('../../src/middleware/auth');

function createMonitoringRouter({ wss, rateLimitConfig }) {
  const router = express.Router();

  router.get('/', auth, authorize(['superadmin']), async (req, res) => {
    try {
      const memory = process.memoryUsage();
      const clients = Array.from(wss?.clients || []);

      const wsStats = {
        totalConnections: clients.length,
        authenticatedConnections: clients.filter((client) => client.isAuthenticated).length,
        deviceConnections: clients.filter((client) => client.isDevice).length,
        adminConnections: clients.filter((client) => !client.isDevice && client.isAuthenticated).length
      };

      const rateLimits = Object.entries(rateLimitConfig || {}).map(([key, config]) => ({
        type: key,
        windowMs: config.windowMs,
        max: config.max,
        windowSeconds: Math.round(config.windowMs / 1000),
        note: 'Real-time usage not available - rate limiting handled by express-rate-limit'
      }));

      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const recentRequests = global.requestStats?.filter((stat) => stat.timestamp > fiveMinutesAgo) || [];
      const apiResponse = {
        avgTime: recentRequests.length > 0
          ? Math.round(recentRequests.reduce((sum, stat) => sum + stat.duration, 0) / recentRequests.length)
          : 0,
        errorRate: recentRequests.length > 0
          ? Math.round((recentRequests.filter((stat) => stat.status >= 400).length / recentRequests.length) * 100)
          : 0,
        totalRequests: recentRequests.length,
        requestsPerMinute: recentRequests.length > 0 ? Math.round(recentRequests.length / 5) : 0
      };

      const dbStats = {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      };

      const activeUsers = await User.countDocuments({
        lastLogin: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      });

      const activePlayers = await Player.countDocuments({
        last_seen: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      });

      res.json({
        timestamp: new Date().toISOString(),
        system: {
          uptime: process.uptime(),
          memory: {
            heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
            rss: Math.round(memory.rss / 1024 / 1024),
            external: Math.round(memory.external / 1024 / 1024)
          },
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          cpuUsage: process.cpuUsage()
        },
        websocket: wsStats,
        rateLimits,
        apiResponse,
        database: dbStats,
        activeUsers,
        activePlayers
      });
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      res.status(500).json({ error: 'Failed to fetch monitoring data' });
    }
  });

  return router;
}

module.exports = { createMonitoringRouter };
