// Import http directly
const http = require('http');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const helmet = require('helmet');

// Load environment variables before importing cron jobs or config modules.
dotenv.config();

require('./src/cron/registrationReminders'); // Initialize registration reminders cron job
require('./src/cron/tokenMaintenance'); // Initialize token maintenance cron job
require('./src/cron/cloudinaryCleanup'); // Initialize Cloudinary screenshot cleanup cron job
const path = require('path');
const { registerApiRoutes } = require('./server/routes');
const { secureLog } = require('./src/utils/secureLogger');
const { versionMiddleware } = require('./src/middleware/versionMiddleware');
const { requestStatsMiddleware } = require('./server/middleware/requestStats');
const { securityLoggingMiddleware } = require('./server/middleware/securityLogging');
const { startPlayerActivityMonitor } = require('./server/services/playerActivityMonitor');
const { validateEnvironment } = require('./server/config/environment');
const { connectDatabase } = require('./server/config/database');
const { createCorsOptions } = require('./server/config/cors');
const {
  rateLimitConfig,
  mutationLimiterMiddleware,
  queryLimiter,
  realtimeLimiter,
  rateLimitHeadersMiddleware
} = require('./server/config/rateLimits');
const { setupWebSocketServer } = require('./server/websocket/server');

validateEnvironment();
connectDatabase();

// Apply routes
const app = express();
const PORT = process.env.PORT || 5001;

// Configure trust proxy
app.set('trust proxy', 1);

const corsOptions = createCorsOptions();

// Apply compression for better performance
app.use(compression({
  filter: (req, res) => {
    // Don't compress WebSocket requests
    if (req.headers.upgrade === 'websocket') {
      return false;
    }
    // Compress all other requests
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6 // Compression level (1-9, 6 is default)
}));

app.use(securityLoggingMiddleware);

// Apply CORS
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Apply API versioning middleware
app.use(versionMiddleware);

// Security Headers Configuration
if (process.env.NODE_ENV === 'production') {
  const cspConnectSrc = [
    "'self'",
    ...(process.env.CSP_CONNECT_SRC?.split(',').map((value) => value.trim()).filter(Boolean) || [
      'https://player-dashboard.onrender.com',
      'wss://player-dashboard.onrender.com'
    ])
  ];
  const cloudinaryImageSrc = process.env.CLOUDINARY_CLOUD_NAME
    ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`
    : 'https://res.cloudinary.com';

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://www.google.com", "https://www.gstatic.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", cloudinaryImageSrc],
        connectSrc: cspConnectSrc,
        frameSrc: ["'self'", "https://www.google.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
} else {
  app.use(helmet());
}

// Configure body parser with explicit limits and types
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  secureLog.info(`${req.method} ${req.path} (API Version: ${req.apiVersion})`);
  next();
});

// Apply real-time limiter to player-related endpoints
app.use('/api/players', realtimeLimiter);

// Apply query limiter to GET requests
app.use('/api/companies', queryLimiter);
app.use('/api/users', queryLimiter);

// Apply mutation limiter to modification endpoints
app.use(mutationLimiterMiddleware);

// Add rate limit headers
app.use(rateLimitHeadersMiddleware);

// API version header for all responses
app.use((req, res, next) => {
  res.setHeader('X-API-Version', req.apiVersion || 'v1');
  next();
});

// Create HTTP server
const server = http.createServer(app);

// Increase max header size to handle larger request headers (default is 8KB)
server.maxHeaderSize = 65536; // 64KB

// Increase server limits for high concurrency
server.maxConnections = 10000; // Allow up to 10,000 concurrent connections
server.keepAliveTimeout = 65000; // 65 seconds (slightly longer than default)
server.headersTimeout = 66000; // 66 seconds (slightly longer than keepAlive)

const wss = setupWebSocketServer(server);

// API Routes

app.use(requestStatsMiddleware);

registerApiRoutes(app, { wss, rateLimitConfig });

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Running in ${process.env.NODE_ENV} mode`);
});

// Initialize player activity monitor
startPlayerActivityMonitor();

// Serve static files from the React build directory after all API routes are registered.
app.use(express.static(path.join(__dirname, 'build')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Handle all remaining non-API routes by serving the React app.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
