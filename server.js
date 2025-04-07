// Import http directly
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const Mailjet = require('node-mailjet');
const crypto = require('crypto');
const { WebSocket, WebSocketServer } = require('ws');
const helmet = require('helmet');
const User = require('./src/models/User');
const Company = require('./src/models/Company');
const Player = require('./src/models/Player');
const Command = require('./src/models/Command');
const { sendPasswordResetEmail, sendRegistrationInvitationEmail } = require('./src/services/emailService');
require('./src/cron/registrationReminders'); // Initialize registration reminders cron job
require('./src/cron/tokenMaintenance'); // Initialize token maintenance cron job
const { validatePassword } = require('./src/utils/passwordValidation');
const {
  generateTOTPSecret,
  verifyTOTPSetup,
  verifyTOTP,
  disable2FA,
  get2FAStatus
} = require('./src/services/twoFactorService');
const rateLimit = require('express-rate-limit');
const RefreshToken = require('./src/models/RefreshToken');
const { isTokenBlacklisted, addToBlacklist } = require('./src/services/tokenBlacklistService');
const { auth, authorize } = require('./src/middleware/auth');
const path = require('path');
const playerRoutes = require('./src/routes/player');
const { secureLog } = require('./src/utils/secureLogger');
const { signRequest, verifySignature, signatureMiddleware } = require('./src/services/requestSigningService');
const { versionMiddleware } = require('./src/middleware/versionMiddleware');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  refreshAccessToken, 
  revokeRefreshToken,
  revokeAllUserRefreshTokens
} = require('./src/services/refreshTokenService');
const axios = require('axios');

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  secureLog.error('Error: Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  secureLog.info('✅ MongoDB Connected successfully');
})
.catch((err) => {
  secureLog.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});

// Apply routes
const app = express();
const PORT = process.env.PORT || 5001;

// Configure trust proxy
app.set('trust proxy', 1);

// Parse allowed origins from environment variable
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push('https://player-dashboard.onrender.com');
}
const corsMaxAge = parseInt(process.env.CORS_MAX_AGE) || 86400;

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Check if the origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: corsMaxAge
};

// Standard API limiter for mutations (POST, PUT, DELETE)
const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: { error: 'Te veel mutatie verzoeken. Probeer het later opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false
});

// More permissive limiter for GET requests
const queryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  message: { error: 'Te veel data verzoeken. Probeer het later opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Special limiter for real-time endpoints
const realtimeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600, // 600 requests per minute (10 requests per second)
  message: { error: 'Te veel real-time verzoeken. Probeer het later opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication limiter
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 attempts
  message: { error: 'Te veel inlogpogingen. Probeer het over 5 minuten opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting configurations
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Allow more attempts during development
  message: { error: 'Te veel inlogpogingen. Probeer het later opnieuw.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply CORS
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Apply API versioning middleware
app.use(versionMiddleware);

// Security Headers Configuration
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.google.com", "https://www.gstatic.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:", "https:", "https://player-dashboard.onrender.com"],
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
app.use(bodyParser.json({ limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  secureLog.info(`${req.method} ${req.path} (API Version: ${req.apiVersion})`);
  next();
});

// Apply rate limiters to different route types
app.use('/api/auth/login', loginLimiter);

// Apply real-time limiter to player-related endpoints
app.use('/api/players', realtimeLimiter);

// Apply query limiter to GET requests
app.use('/api/companies', queryLimiter);
app.use('/api/users', queryLimiter);

// Apply mutation limiter to modification endpoints
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return mutationLimiter(req, res, next);
  }
  next();
});

// Add rate limit headers
app.use((req, res, next) => {
  res.header('X-RateLimit-Limit', req.rateLimit?.limit);
  res.header('X-RateLimit-Remaining', req.rateLimit?.remaining);
  res.header('X-RateLimit-Reset', req.rateLimit?.reset);
  next();
});

// Apply API versioning middleware
app.use(versionMiddleware);

// API version header for all responses
app.use((req, res, next) => {
  res.setHeader('X-API-Version', req.apiVersion || 'v1');
  next();
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server with secure configuration
const wss = new WebSocketServer({
  noServer: true, // Use noServer option instead of directly attaching to the server
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    threshold: 1024 // Only compress messages larger than this
  }
});

// Handle upgrade requests manually
server.on('upgrade', function upgrade(request, socket, head) {
  console.log('WebSocket upgrade request received', request.url);
  
  // Only handle requests to /api
  if (request.url !== '/api') {
    console.log('WebSocket connection rejected: Invalid path', request.url);
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  
  try {
    // Extract token from Sec-WebSocket-Protocol header
    let token = null;
    const protocols = request.headers['sec-websocket-protocol'];
    
    if (protocols) {
      const jwtProtocol = protocols.split(', ').find(p => p.startsWith('jwt.'));
      if (jwtProtocol) {
        token = jwtProtocol.substring(4); // Remove 'jwt.' prefix
        console.log('Token found in protocol (truncated):', token.substring(0, 15) + '...');
      }
    }
    
    if (!token) {
      console.log('WebSocket connection rejected: No token provided');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    
    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        audience: 'player-dashboard-api',
        issuer: 'player-dashboard'
      });
      
      if (!decoded.sub || !decoded.email || !decoded.role) {
        console.log('WebSocket token missing required claims');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      
      // Store user info for later use
      request.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        company_id: decoded.company_id
      };
      
      console.log('WebSocket authenticated for user:', { email: decoded.email });
      
      // Upgrade the connection
      wss.handleUpgrade(request, socket, head, function done(ws) {
        // Attach user info to the WebSocket
        ws.user = request.user;
        
        // Emit connection event
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      console.log('WebSocket token verification failed:', error.message);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  } catch (error) {
    console.error('WebSocket upgrade error:', error);
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    socket.destroy();
  }
});

// Log all WebSocket server events for debugging
wss.on('listening', () => {
  console.log('WebSocket server is listening');
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

// PING configuration to detect dead connections
const PING_INTERVAL = 30000; // 30 seconds
const PING_TIMEOUT = 5000; // 5 seconds

// Add security headers for WebSocket connections
wss.on('headers', (headers, request) => {
  // Add security headers to WebSocket handshake
  headers.push('Strict-Transport-Security: max-age=31536000; includeSubDomains');
  headers.push('X-Content-Type-Options: nosniff');
  headers.push('X-XSS-Protection: 1; mode=block');
  headers.push('X-Frame-Options: DENY');
});

// Initialize Firebase Admin
const firebaseAdmin = require('./server/services/firebaseAdmin');
firebaseAdmin.initialize();

// Initialize Mailjet if credentials are provided
let mailjet;
if (process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY) {
  mailjet = new Mailjet({
    apiKey: process.env.MAILJET_API_KEY,
    apiSecret: process.env.MAILJET_SECRET_KEY
  });
  secureLog.info('Mailjet client initialized successfully');
} else {
  secureLog.warn('Mailjet credentials not found, email functionality will be unavailable');
}

// Token generation function with enhanced security
const generateToken = (user) => {
  if (!user || !user._id || !user.email || !user.role) {
    throw new Error('Invalid user data for token generation');
  }

  // Generate a unique jti (JWT ID)
  const jti = crypto.randomBytes(16).toString('hex');

  const token = jwt.sign(
    { 
      jti,
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      company_id: user.company_id
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: '15m', // Reduced from 24h to 15m
      algorithm: 'HS256',
      audience: 'player-dashboard-api',
      issuer: 'player-dashboard'
    }
  );

  return { token, jti };
};

// Enhanced authentication middleware with additional security checks
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience: 'player-dashboard-api',
      issuer: 'player-dashboard',
      clockTolerance: 30
    });
    
    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(decoded.jti);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    // Enhanced validation
    if (!decoded.sub) {
      return res.status(403).json({ error: 'Invalid token format' });
    }
    
    // Fetch current user data from database to verify role
    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    // Verify that the role in token matches current database role
    if (decoded.role !== user.role) {
      return res.status(403).json({ error: 'Role mismatch - please log in again' });
    }
    
    // Store minimal user info in request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: user.role, // Use role from database instead of token
      company_id: decoded.company_id,
      jti: decoded.jti
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    return res.status(403).json({ error: 'Token verification failed' });
  }
};

// Message batching configuration
const BATCH_INTERVAL = 1000; // 1 second
const pendingUpdates = new Map();

// Modified broadcast function with batching
const broadcastEvent = (eventType, data) => {
  // For non-player events, broadcast immediately
  if (!eventType.startsWith('player_')) {
    const message = JSON.stringify({ type: eventType, data });
    broadcastToClients(message);
    return;
  }

  // For player events, batch updates
  const playerId = data.id || data._id;
  if (!playerId) return;

  if (!pendingUpdates.has(playerId)) {
    pendingUpdates.set(playerId, {
      data,
      timestamp: Date.now()
    });

    // Schedule batch update
    setTimeout(() => {
      const update = pendingUpdates.get(playerId);
      if (update) {
        const message = JSON.stringify({
          type: eventType,
          data: update.data,
          batchTimestamp: Date.now()
        });
        broadcastToClients(message);
        pendingUpdates.delete(playerId);
      }
    }, BATCH_INTERVAL);
  } else {
    // Update existing pending update
    const existing = pendingUpdates.get(playerId);
    pendingUpdates.set(playerId, {
      data: { ...existing.data, ...data },
      timestamp: Date.now()
    });
  }
};

// Helper function to broadcast to clients
const broadcastToClients = (message) => {
  wss.clients.forEach((client) => {
    // Only send to authenticated clients
    if (!client.user) return;
    
    // Filter messages based on user role and company
    if (client.user.role !== 'superadmin') {
      const data = JSON.parse(message).data;
      
      // For company events, only superadmin receives all updates
      if (message.startsWith('company_')) {
        return;
      }
      
      // For player events, only send if it's for their company
      if (message.startsWith('player_') && 
          data.company_id !== client.user.company_id) {
        return;
      }
    }
    
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// Add heartbeat mechanism
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 35000;

// Add these constants near other WebSocket-related constants
const TOKEN_VERIFICATION_INTERVAL = 60000; // Verify token every minute
const ACTIVE_CONNECTIONS = new Map(); // Track active connections

// Handle WebSocket authentication
const handleAuthentication = async (ws, message) => {
  try {
    // Verify the token
    const decoded = jwt.verify(message.token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      audience: 'player-dashboard-api',
      issuer: 'player-dashboard'
    });
    
    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(decoded.jti);
    if (isBlacklisted) {
      console.log('Token blacklisted, closing connection');
      ws.close(4401, 'Token has been revoked');
      return;
    }

    // Verify user still exists and has same role
    const user = await User.findById(decoded.sub);
    if (!user || user.role !== decoded.role) {
      console.log('User changed or deleted, closing connection');
      ws.close(4401, 'User authentication invalid');
      return;
    }

    // Update connection info
    const connInfo = ACTIVE_CONNECTIONS.get(ws);
    if (connInfo) {
      connInfo.token = message.token;
      ACTIVE_CONNECTIONS.set(ws, connInfo);
    }
    
    ws.clientId = message.clientId;
    console.log('WebSocket authenticated via message for user:', decoded.email);

    // Send authentication success response
    ws.send(JSON.stringify({
      type: 'auth_success',
      timestamp: Date.now()
    }));
  } catch (error) {
    console.log('WebSocket message authentication failed:', error.message);
    ws.close(4401, 'Authentication failed');
  }
};

// Handle status update
const handleStatusUpdate = async (ws, data) => {
  try {
    // Verify client is authenticated
    if (!ws.clientId) {
      ws.close(4401, 'Not authenticated');
      return;
    }

    // Broadcast status update to relevant clients
    broadcastToClients(JSON.stringify({
      type: 'status_update',
      data: data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error handling status update:', error);
  }
};

// Handle command response
const handleCommandResponse = async (ws, data) => {
  try {
    // Verify client is authenticated
    if (!ws.clientId) {
      ws.close(4401, 'Not authenticated');
      return;
    }

    // Process command response
    broadcastToClients(JSON.stringify({
      type: 'command_response',
      data: data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error handling command response:', error);
  }
};

// Validate WebSocket message format
const validateMessage = (message) => {
  if (!message || typeof message !== 'object') return false;
  if (!message.type || typeof message.type !== 'string') return false;
  
  switch (message.type) {
    case 'authenticate':
      return message.token && message.clientId && message.timestamp;
    case 'status_update':
    case 'command_response':
      return message.data && message.timestamp;
    default:
      return false;
  }
};

// Handle WebSocket connections
wss.on('connection', function connection(ws, req) {
  console.log('New WebSocket connection established');
  ws.isAlive = true;
  ws.pingTimeout = null;

  // Set up ping interval for this connection
  const pingInterval = setInterval(() => {
    if (!ws.isAlive) {
      clearInterval(pingInterval);
      clearTimeout(ws.pingTimeout);
      return ws.terminate();
    }

    ws.isAlive = false;
    ws.ping();
    ws.pingTimeout = setTimeout(() => {
      ws.terminate();
    }, PING_TIMEOUT);
  }, PING_INTERVAL);

  ws.on('pong', () => {
    ws.isAlive = true;
    clearTimeout(ws.pingTimeout);
  });

  ws.on('message', (message) => {
    try {
      // Handle both string and object messages
      let parsedMessage;
      try {
        if (typeof message === 'string') {
          parsedMessage = JSON.parse(message);
        } else {
          parsedMessage = JSON.parse(message.toString());
        }
      } catch (parseError) {
        console.warn('Failed to parse WebSocket message:', message.toString());
        return;
      }

      // Handle different message types
      switch (parsedMessage.type) {
        case 'player_created':
        case 'player_updated':
        case 'player_deleted':
          if (!parsedMessage.data) {
            console.warn('Missing data for operation:', parsedMessage.type);
            return;
          }
          broadcastEvent(parsedMessage.type, parsedMessage.data);
          break;
          
        case 'pong':
          ws.isAlive = true;
          break;

        case 'ping':
          // Respond to ping with pong to keep connection alive
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          ws.isAlive = true;
          break;

        case 'heartbeat':
          // Handle heartbeat message
          ws.send(JSON.stringify({ type: 'heartbeat_ack', timestamp: Date.now() }));
          ws.isAlive = true;
          break;
          
        default:
          console.warn('Unknown message type:', parsedMessage.type);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  // Clear intervals on close
  ws.on('close', () => {
    clearInterval(pingInterval);
    clearTimeout(ws.pingTimeout);
  });
});

// API Routes

// Company routes
app.get('/api/companies', auth, authorize(['superadmin', 'bedrijfsadmin', 'user']), async (req, res) => {
  try {
    let userData = req.user;
    
    // If user is not superadmin, only return their company
    if (userData.role !== 'superadmin') {
      if (!userData.company_id) {
        return res.json([{ company_name: 'Unknown Company' }]);
      }
      
      // Use the new findByAnyId method
      const company = await Company.findByAnyId(userData.company_id);
      return res.json(company ? [company] : [{ company_name: 'Unknown Company' }]);
    }
    
    // For superadmin, return all companies
    const companies = await Company.find().sort({ company_name: 1 });
    return res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/companies', auth, authorize(['superadmin']), async (req, res) => {
  try {
    // Create new company
    const company = new Company({
      ...req.body,
      company_id: req.body.company_id || new mongoose.Types.ObjectId().toString()
    });
    await company.save();
    broadcastEvent('company_created', company);
    return res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/companies/:id', auth, authorize(['superadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find company using the new method
    const company = await Company.findByAnyId(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    // Update company fields
    Object.assign(company, req.body);
    await company.save();
    
    broadcastEvent('company_updated', company);
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/companies/:id', auth, authorize(['superadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find and delete company using the new method
    const company = await Company.findByAnyId(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    await company.deleteOne();
    broadcastEvent('company_deleted', { id });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Player routes
app.get('/api/players', auth, authorize(['superadmin', 'bedrijfsadmin', 'user']), async (req, res) => {
  try {
    let userData = req.user;
    let query = {};
    
    // If user is not superadmin, only show players from their company
    if (userData.role !== 'superadmin') {
      if (!userData.company_id) {
        return res.json([]); // No company, no players
      }
      query.company_id = userData.company_id;
    }
    
    const players = await Player.find(query).sort({ device_id: 1 });
    return res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/players', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    // Create new player
    const player = new Player({
      ...req.body,
      is_online: false, // Default to offline
      last_seen: new Date()
    });
    
    await player.save();
    broadcastEvent('player_created', player);
    return res.status(201).json(player);
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/players/:id', auth, authorize(['superadmin', 'bedrijfsadmin', 'user']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid player ID format' });
    }
    
    // Check if player exists
    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // If user is not superadmin, they can only update players from their own company
    // and cannot update device_id under any circumstances
    if (req.user.role !== 'superadmin') {
      if (req.user.company_id !== player.company_id) {
        return res.status(403).json({ error: 'You can only update players from your own company' });
      }
      
      // Prevent device_id modification for non-superadmins
      if ('device_id' in updates) {
        return res.status(403).json({ error: 'Only superadmins can modify device IDs' });
      }
    }
    
    // Update the player
    const updatedPlayer = await Player.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    
    broadcastEvent('player_updated', updatedPlayer);
    return res.status(200).json(updatedPlayer);
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete player
app.delete('/api/players/:id', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    // Find the player first
    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Check if user has permission to delete this player
    if (user.role !== 'superadmin' && player.company_id !== user.company_id) {
      return res.status(403).json({ error: 'Not authorized to delete this player' });
    }
    
    // Delete all commands associated with this player
    try {
      await Command.deleteMany({ player_id: id });
    } catch (error) {
      console.error('Error deleting player commands:', error);
      // Continue with player deletion even if command deletion fails
    }
    
    // Delete the player
    await player.deleteOne();
    
    // Broadcast the deletion event
    broadcastEvent('player_deleted', { id });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting player:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/players/:id/commands', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const commandData = req.body;
    
    let playerId;
    try {
      playerId = mongoose.Types.ObjectId(id);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid player ID format' });
    }
    
    // Check if player exists
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Create and save the command
    const command = new Command({
      player_id: playerId,
      command_type: commandData.type,
      payload: commandData.payload || {},
      status: 'pending'
    });
    
    await command.save();
    return res.json(command);
  } catch (error) {
    console.error('Error creating command:', error);
    res.status(500).json({ error: error.message });
  }
});

// User routes
app.get('/api/users', auth, authorize(['superadmin', 'bedrijfsadmin', 'user']), async (req, res) => {
  try {
    let userData = req.user;
    let query = {};
    
    // If user is not superadmin, only show users from their company
    if (userData.role !== 'superadmin') {
      if (!userData.company_id) {
        return res.json([]); // No company, no users
      }
      query.company_id = userData.company_id;
    }
    
    const users = await User.find(query)
      .select('-passwordHash -resetPasswordToken -resetPasswordExpires')
      .sort({ email: 1 });
      
    return res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const user = await User.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user endpoint
app.delete('/api/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Only allow superadmins to delete users
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Don't allow deleting the last superadmin
    if (user.role === 'superadmin') {
      const superadminCount = await User.countDocuments({ role: 'superadmin' });
      if (superadminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last superadmin' });
      }
    }
    
    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// reCAPTCHA verification function
const verifyRecaptcha = async (token) => {
  try {
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token
      }
    });
    return response.data.success;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
};

// Login endpoint
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    console.log('Login attempt received:', { email: req.body.email });
    const { email, password, recaptchaToken } = req.body;

    // Input validation
    if (!email || !password) {
      console.log('Missing credentials:', { email: !!email, password: !!password });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isActive: true
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user has exceeded login attempts
    const loginAttempts = user.loginAttempts || 0;
    if (loginAttempts >= 3) {
      // Verify reCAPTCHA if attempts >= 3
      if (!recaptchaToken) {
        return res.status(400).json({ error: 'CAPTCHA verification required' });
      }

      const isValidCaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidCaptcha) {
        return res.status(400).json({ error: 'Invalid CAPTCHA' });
      }
    }

    // Verify password
    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      // Increment login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      await user.save();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    await user.save();

    // Check if 2FA is enabled
    const twoFAStatus = await get2FAStatus(user._id);
    if (twoFAStatus.enabled) {
      const tempToken = jwt.sign(
        { 
          id: user._id, 
          requires2FA: true,
          email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ requires2FA: true, tempToken });
    }

    // Generate access token
    const { token, jti } = generateToken(user);
    
    // Generate refresh token
    const refreshToken = await RefreshToken.generateRefreshToken(user._id);

    console.log('Login successful:', { userId: user._id, email: user.email });
    
    res.json({
      token: token,
      refreshToken: refreshToken.token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New refresh token endpoint
app.post('/api/auth/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Find the refresh token in the database
    const savedToken = await RefreshToken.findOne({ token: refreshToken });
    
    if (!savedToken || !savedToken.isActive()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Get user information
    const user = await User.findById(savedToken.user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new tokens
    const newAccessToken = generateToken(user);
    const newRefreshToken = await RefreshToken.generateRefreshToken(user._id);

    // Revoke the old refresh token
    savedToken.revokedAt = new Date();
    savedToken.replacedByToken = newRefreshToken.token;
    await savedToken.save();

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken.token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Modify the logout endpoint to disconnect WebSocket sessions
app.post('/api/auth/logout', auth, async (req, res) => {
  try {
    // Add the current access token to the blacklist
    const exp = Math.floor(Date.now() / 1000) + (15 * 60); // 15 minutes from now
    await addToBlacklist(req.user.jti, exp, req.user.id, req.token, 'LOGOUT');

    // If refresh token is provided, revoke it
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.revokeToken(refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, registrationToken } = req.body;

    // Input validation
    if (!email || !password || !registrationToken) {
      return res.status(400).json({ error: 'Email, password, and registration token are required' });
    }

    // Validate password strength
    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        passwordErrors: errors
      });
    }

    // Find user with valid registration token
    const user = await User.findOne({
      registrationToken,
      registrationTokenExpires: { $gt: Date.now() },
      isActive: false
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired registration token' });
    }

    // Update email if different from invitation
    if (email !== user.email) {
      // Check if new email is already in use
      const existingUser = await User.findOne({ email: email.toLowerCase(), isActive: true });
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
      user.email = email.toLowerCase();
    }

    // Set password and activate account
    await user.setPassword(password);
    user.isActive = true;
    user.registrationToken = undefined;
    user.registrationTokenExpires = undefined;
    
    await user.save();
    
    console.log('✅ User registration completed:', { email, role: user.role });

    // Generate JWT token using the consistent token generation function
    const token = generateToken(user);

    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Password reset request endpoint
app.options('/api/auth/forgot-password', cors());
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    console.log('🔍 Password reset endpoint hit with request body:', req.body);
    const { email } = req.body;
    
    // Enhanced input validation
    if (!email) {
      console.log('❌ Missing email in request');
      return res.status(400).json({
        error: 'Email is required',
        field: 'email',
        message: 'Voer een e-mailadres in'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Invalid email format:', email);
      return res.status(400).json({
        error: 'Invalid email format',
        field: 'email',
        message: 'Voer een geldig e-mailadres in'
      });
    }

    console.log(`📧 Processing password reset for email: ${email.toLowerCase()}`);

    try {
      // Find user in MongoDB
      const user = await User.findOne({ email: email.toLowerCase() });
      console.log('User found:', user ? 'Yes' : 'No');

      if (!user) {
        console.log(`⚠️ User with email ${email} not found in database`);
        // For security, we still return a success message
        return res.json({
          success: true,
          message: 'Als er een account bestaat met dit e-mailadres, ontvang je binnen enkele minuten een e-mail met instructies om je wachtwoord te resetten.'
        });
      }

      // Check if a reset token was recently generated (within last 5 minutes)
      const cooldownPeriod = 5 * 60 * 1000; // 5 minutes in milliseconds
      if (user.resetPasswordExpires && user.resetPasswordExpires.getTime() - Date.now() > (60 * 60 * 1000 - cooldownPeriod)) {
        console.log('⚠️ Reset token recently generated, enforcing cooldown');
        return res.status(429).json({
          error: 'Too many requests',
          message: 'Er is recent al een reset link verzonden. Wacht enkele minuten voordat je het opnieuw probeert.',
          retryAfter: Math.ceil((user.resetPasswordExpires.getTime() - Date.now() - (60 * 60 * 1000 - cooldownPeriod)) / 1000)
        });
      }

      console.log('Generating reset token...');
      // Generate reset token
      const resetToken = user.generateResetToken();
      console.log('Reset token generated:', resetToken);
      
      console.log('Saving user...');
      await user.save();
      console.log('User saved successfully');

      console.log(`✅ Reset token generated for user: ${email}`);

      // Send the email
      console.log('Sending password reset email...');
      const emailResult = await sendPasswordResetEmail(email, resetToken);
      console.log('Email result:', emailResult);
      
      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        return res.status(500).json({
          error: 'Failed to send email',
          message: 'Er is een probleem opgetreden bij het verzenden van de e-mail. Probeer het later opnieuw.'
        });
      }

      // In development, return token for testing
      if (process.env.NODE_ENV === 'development') {
        return res.json({ 
          success: true,
          message: 'Er is een e-mail verzonden met instructies om je wachtwoord te resetten.',
          resetToken: resetToken // Only in development
        });
      }

      return res.json({
        success: true,
        message: 'Als er een account bestaat met dit e-mailadres, ontvang je binnen enkele minuten een e-mail met instructies om je wachtwoord te resetten.'
      });
    } catch (dbError) {
      console.error('❌ Database operation error:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('❌ Password reset error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.'
    });
  }
});

// Reset password endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token: resetToken, password } = req.body;

    if (!resetToken || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    // Validate password strength
    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        passwordErrors: errors
      });
    }

    // Set new password and clear reset token
    await user.setPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.isActive = true;
    user.status = 'active';

    await user.save();
    console.log(`🔑 Password updated for user:`, {
      email: user.email,
      hasPasswordHash: !!user.passwordHash,
      isActive: user.isActive,
      status: user.status
    });
    
    // Generate JWT token using the consistent token generation function
    const jwtToken = generateToken(user);

    return res.json({
      message: 'Password has been reset successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      token: jwtToken
    });
  } catch (error) {
    console.error('❌ Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Registration invitation endpoint
app.post('/api/auth/register-invitation', auth, authorize(['superadmin', 'bedrijfsadmin']), async (req, res) => {
  try {
    console.log('User from token:', req.user);
    const { email, role, company_id } = req.body;
    
    // Basic validation
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }
    
    const normalizedEmail = email.toLowerCase();
    
    // Role-based authorization
    if (req.user.role !== 'superadmin' && req.user.role !== 'bedrijfsadmin') {
      console.log('Unauthorized role:', req.user.role);
      return res.status(403).json({ error: 'Unauthorized to send invitations' });
    }
    
    // Check if user already exists and is active
    const existingUser = await User.findOne({ 
      email: normalizedEmail,
      $or: [
        { isActive: true },
        { status: 'active' }
      ]
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Deze gebruiker is al geregistreerd. Er kan geen nieuwe uitnodiging worden verzonden.' 
      });
    }
    
    // Additional validation for bedrijfsadmin
    if (req.user.role === 'bedrijfsadmin') {
      // Can only create regular users and bedrijfsadmins
      if (role !== 'user' && role !== 'bedrijfsadmin') {
        return res.status(403).json({ error: 'Bedrijfsadmins can only create regular users and bedrijfsadmins' });
      }
      
      // Must use their own company_id
      const effectiveCompanyId = company_id || req.user.company_id;
      if (effectiveCompanyId !== req.user.company_id) {
        return res.status(403).json({ error: 'Cannot create users for other companies' });
      }
      
      // Check user limit (max 5 users per company)
      const companyUsers = await User.find({ company_id: req.user.company_id });
      if (companyUsers.length >= 5) {
        return res.status(403).json({ error: 'Maximum number of users reached for this company' });
      }
    }
    
    // Check if there's a pending invitation
    let user = await User.findOne({ 
      email: normalizedEmail,
      status: 'pending'
    });
    
    if (user) {
      // Check last invitation time
      const lastInviteTime = user.lastReminderSent || user.createdAt;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      
      if (lastInviteTime && lastInviteTime > oneHourAgo) {
        const minutesLeft = Math.ceil((lastInviteTime.getTime() + 60 * 60 * 1000 - Date.now()) / (60 * 1000));
        return res.status(429).json({ 
          error: `Er is recent een uitnodiging verzonden. Wacht nog ${minutesLeft} minuten voordat je een nieuwe uitnodiging verstuurt.` 
        });
      }
      
      // Update existing pending user
      user.role = role;
      user.company_id = company_id || req.user.company_id;
      user.lastReminderSent = new Date();
    } else {
      // Create new user
      user = new User({
        email: normalizedEmail,
        role: role,
        company_id: company_id || req.user.company_id,
        status: 'pending',
        lastReminderSent: new Date()
      });
    }
    
    // Generate registration token
    const registrationToken = user.generateRegistrationToken();
    await user.save();
    
    // Get company name for email
    let companyName = '';
    if (user.company_id) {
      const company = await Company.findOne({ company_id: user.company_id });
      if (company) {
        companyName = company.company_name;
      }
    }
    
    // Send invitation email
    const emailResult = await sendRegistrationInvitationEmail(
      normalizedEmail,
      registrationToken,
      role,
      companyName
    );
    
    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error);
      return res.status(500).json({ error: 'Failed to send invitation email' });
    }
    
    // Return a complete response with user information
    res.json({ 
      message: 'Invitation sent successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Registration invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete registration endpoint
app.post('/api/auth/complete-registration', async (req, res) => {
  try {
    const { token: registrationToken, password, email } = req.body;

    if (!registrationToken) {
      return res.status(400).json({ error: 'Registration token is required' });
    }

    // Find user with valid registration token
    const user = await User.findOne({
      registrationToken: registrationToken,
      registrationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired registration token' });
    }

    // If email is provided, update the user's email
    if (email && email !== user.email) {
      // Check if the new email is already in use by an active user
      const existingUser = await User.findOne({ email: email, isActive: true });
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already in use by another user' });
      }
      user.email = email;
    }

    if (password) {
      // Validate password
      const { isValid, errors } = validatePassword(password);
      if (!isValid) {
        return res.status(400).json({ 
          error: 'Password does not meet security requirements',
          passwordErrors: errors
        });
      }

      // Set password and activate account
      await user.setPassword(password);
    } else {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Save the updated user
    await user.save();
    console.log(`✅ Registration completed for user: ${user.email}`);

    // Generate JWT token using the consistent token generation function
    const token = generateToken(user);

    return res.json({
      message: 'Registration completed successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      token
    });
  } catch (error) {
    console.error('Registration completion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend registration invitation
app.post('/api/auth/resend-invitation/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow superadmins to resend invitations
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isActive) {
      return res.status(400).json({ error: 'User is already active' });
    }

    // Get company name if company_id exists
    let companyName = '';
    if (user.company_id) {
      const company = await Company.findOne({ company_id: user.company_id });
      if (company) {
        companyName = company.company_name;
      }
    }

    // Generate new registration token
    const registrationToken = user.generateRegistrationToken();
    user.lastReminderSent = new Date();
    await user.save();

    // Send invitation email
    const emailResult = await sendRegistrationInvitationEmail(
      user.email,
      registrationToken,
      user.role,
      companyName
    );

    if (!emailResult.success) {
      console.error('Failed to send invitation reminder:', emailResult.error);
      return res.status(500).json({
        error: 'Failed to send invitation reminder',
        message: 'Er is een probleem opgetreden bij het verzenden van de herinnering. Probeer het later opnieuw.'
      });
    }

    console.log('✅ Registration reminder sent to:', user.email);

    return res.json({
      success: true,
      message: 'Herinnering is verzonden.'
    });
  } catch (error) {
    console.error('❌ Resend invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify registration token and get user info
app.get('/api/auth/verify-token', async (req, res) => {
  try {
    const { token } = req.query;
    secureLog.info('Verify token request received');

    if (!token) {
      secureLog.warn('No token provided');
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find user with valid registration token
    const user = await User.findOne({
      registrationToken: token,
      registrationTokenExpires: { $gt: Date.now() },
      isActive: false
    });

    if (!user) {
      secureLog.warn('Invalid or expired token');
      return res.status(400).json({ error: 'Invalid or expired registration token' });
    }

    let company_name = '';
    if (user.company_id) {
      secureLog.info('Looking up company');
      const company = await Company.findOne({ company_id: user.company_id });
      if (company) {
        company_name = company.company_name;
        secureLog.info('Company found');
      } else {
        secureLog.warn('Company not found');
      }
    }

    // Return user info without sensitive data
    const response = {
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      company_name
    };
    secureLog.info('Sending response');

    return res.json(response);
  } catch (error) {
    secureLog.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test route
app.get('/api/users/test', auth, (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Test route working' });
});

// Update password endpoint
app.post('/api/users/update-password', authenticateToken, async (req, res) => {
  try {
    console.log('Password update endpoint hit');
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    console.log('User ID from token:', userId);

    // Input validation
    if (!currentPassword || !newPassword) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('Found user:', user.email);

    // Verify current password
    const isValidPassword = await user.verifyPassword(currentPassword);
    if (!isValidPassword) {
      console.log('Invalid current password for user:', user.email);
      return res.status(401).json({ error: 'Huidig wachtwoord is incorrect' });
    }
    console.log('Current password verified successfully');

    // Validate new password strength
    const { isValid, errors } = validatePassword(newPassword);
    if (!isValid) {
      console.log('New password validation failed:', errors);
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        passwordErrors: errors
      });
    }
    console.log('New password validation passed');

    // Update password
    await user.setPassword(newPassword);
    await user.save();
    console.log('Password updated successfully for user:', user.email);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2FA Routes
app.post('/api/auth/2fa/generate', authenticateToken, async (req, res) => {
  try {
    const result = await generateTOTPSecret(req.user.id);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('Error generating 2FA secret:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/2fa/verify-setup', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const result = await verifyTOTPSetup(req.user.id, token);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('Error verifying 2FA setup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/2fa/verify', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const result = await verifyTOTP(req.user.id, token);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const result = await disable2FA(req.user.id, token);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/2fa/status', authenticateToken, async (req, res) => {
  try {
    const result = await get2FAStatus(req.user.id);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2FA verification endpoint for login
app.post('/api/auth/2fa/verify-login', async (req, res) => {
  try {
    const { token: verificationCode, tempToken } = req.body;

    if (!verificationCode || !tempToken) {
      return res.status(400).json({ error: 'Verification code and temporary token are required' });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (!decoded.requires2FA) {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    // Get user and check 2FA status
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const twoFAStatus = await get2FAStatus(user._id);
    if (!twoFAStatus.enabled) {
      return res.status(400).json({ error: '2FA is not enabled for this user' });
    }

    // Verify 2FA token
    const result = await verifyTOTP(decoded.id, verificationCode);
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }

    // Generate final tokens
    const { token, jti } = generateToken(user);
    const refreshToken = await RefreshToken.generateRefreshToken(user._id);

    // Return user data and tokens
    res.json({
      token,
      refreshToken: refreshToken.token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      }
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Monitoring endpoint
app.get('/api/monitoring', auth, authorize(['superadmin']), async (req, res) => {
  try {
    // Get memory usage
    const memory = process.memoryUsage();

    // Get WebSocket stats
    const wsStats = {
      totalConnections: wss.clients.size,
      authenticatedConnections: Array.from(wss.clients).filter(client => client.isAuthenticated).length
    };

    // Get rate limit stats
    const rateLimits = {
      auth: {
        max: authLimiter.max,
        current: authLimiter.current,
        remaining: authLimiter.remaining
      },
      query: {
        max: queryLimiter.max,
        current: queryLimiter.current,
        remaining: queryLimiter.remaining
      },
      mutation: {
        max: mutationLimiter.max,
        current: mutationLimiter.current,
        remaining: mutationLimiter.remaining
      }
    };

    // Calculate API response times (last 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentRequests = global.requestStats?.filter(stat => stat.timestamp > fiveMinutesAgo) || [];
    const apiResponse = {
      avgTime: recentRequests.length > 0 
        ? recentRequests.reduce((sum, stat) => sum + stat.duration, 0) / recentRequests.length 
        : 0,
      errorRate: recentRequests.length > 0
        ? (recentRequests.filter(stat => stat.status >= 400).length / recentRequests.length) * 100
        : 0,
      totalRequests: recentRequests.length
    };

    // System info
    const system = {
      uptime: process.uptime(),
      memory: {
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        rss: memory.rss
      },
      nodeVersion: process.version
    };

    res.json({
      timestamp: new Date().toISOString(),
      system,
      websocket: wsStats,
      rateLimits,
      apiResponse
    });
  } catch (error) {
    console.error('Error fetching monitoring data:', error);
    res.status(500).json({ error: 'Failed to fetch monitoring data' });
  }
});

// Add request tracking for monitoring
if (!global.requestStats) {
  global.requestStats = [];
}

app.use((req, res, next) => {
  const start = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    // Add request stats
    global.requestStats.push({
      path: req.path,
      method: req.method,
      status: res.statusCode,
      duration,
      timestamp: Date.now()
    });
    
    // Keep only last 1000 requests
    if (global.requestStats.length > 1000) {
      global.requestStats = global.requestStats.slice(-1000);
    }
    
    // Call original end
    originalEnd.apply(this, args);
  };
  
  next();
});

// Root route handler
app.get('/api', (req, res) => {
  res.json({ message: 'API is running' });
});

// Add command routes
const commandRoutes = require('./server/routes/commands');
app.use('/api/commands', commandRoutes);

// Add auth routes
const authRoutes = require('./server/routes/auth');
app.use('/api/auth', authRoutes);

// Add user routes
const userRoutes = require('./server/routes/users');
app.use('/api/users', userRoutes);

// Add company routes
const companyRoutes = require('./server/routes/companies');
app.use('/api/companies', companyRoutes);

// Add player routes
app.use('/api/player', playerRoutes);

// Add health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, 'build')));

// Handle all other routes by serving the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Add a new endpoint for public player registration
app.post('/api/public/register-player', async (req, res) => {
  try {
    console.log('📱 New device registration attempt:', req.body);
    
    const { device_id } = req.body;
    let { company_id, name } = req.body;
    
    // Validate required fields
    if (!device_id) {
      console.log('❌ Missing device_id in registration request');
      return res.status(400).json({ error: 'Device ID is required' });
    }
    
    // Use default company if not provided
    if (!company_id) {
      company_id = "NOCOMPANY";
      console.log('⚠️ No company_id provided, using default:', company_id);
    }
    
    // Check if player with this device_id already exists
    const existingPlayer = await Player.findOne({ device_id });
    if (existingPlayer) {
      console.log('ℹ️ Device already registered:', device_id, 'Company:', existingPlayer.company_id);
      return res.status(200).json({ 
        message: 'Player already registered',
        player: existingPlayer
      });
    }
    
    // Create new player
    const player = new Player({
      device_id,
      company_id,
      name: name || `Android Player - ${device_id.substring(0, 6)}`,
      current_url: req.body.current_url || '',
      is_online: true
    });
    
    await player.save();
    console.log('✅ New player registered successfully:', device_id, 'Company:', company_id);
    broadcastEvent('player_created', player);
    return res.status(201).json(player);
  } catch (error) {
    console.error('❌ Error registering player:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a simple form-based player creation endpoint
app.post('/create-player', async (req, res) => {
  try {
    console.log('📝 New player creation from form:', req.body);
    
    const { deviceId } = req.body;
    let { companyId, name } = req.body;
    
    // Validate required fields
    if (!deviceId) {
      console.log('❌ Missing deviceId in form submission');
      return res.status(400).send('Device ID is required');
    }
    
    // Use default company if not provided
    if (!companyId) {
      companyId = "NOCOMPANY";
      console.log('⚠️ No companyId provided in form, using default:', companyId);
    }
    
    // Check if player with this device_id already exists
    const existingPlayer = await Player.findOne({ device_id: deviceId });
    if (existingPlayer) {
      console.log('ℹ️ Device already registered via form:', deviceId);
      return res.status(200).send(`
        <html>
          <head><title>Player Already Registered</title></head>
          <body>
            <h1>Player Already Registered</h1>
            <p>Player with device ID "${deviceId}" is already registered.</p>
            <p><a href="/">Return to Dashboard</a></p>
          </body>
        </html>
      `);
    }
    
    // Create new player
    const player = new Player({
      device_id: deviceId,
      company_id: companyId,
      name: name || `Player - ${deviceId.substring(0, 6)}`,
      current_url: req.body.currentUrl || '',
      is_online: req.body.isOnline === 'true'
    });
    
    await player.save();
    console.log('✅ New player created via form:', deviceId, 'Company:', companyId);
    broadcastEvent('player_created', player);
    
    return res.status(201).send(`
      <html>
        <head><title>Player Created</title></head>
        <body>
          <h1>Player Created Successfully</h1>
          <p>Player with device ID "${deviceId}" has been registered.</p>
          <p><a href="/">Return to Dashboard</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Error creating player from form:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// API Routes with versioning
// We'll wrap these routes to allow both /api and /api/v1 to work
const v1Routes = express.Router();

// Request signing endpoint - must come before other auth routes
v1Routes.post('/auth/sign-request', auth, async (req, res) => {
  try {
    const { payload, userId, timestamp } = req.body;
    
    // Verify the requester is the same as the user ID in the payload
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized attempt to sign request for another user' });
    }
    
    // Verify the timestamp is recent (within last 30 seconds)
    const now = Date.now();
    if (Math.abs(now - timestamp) > 30000) {
      return res.status(400).json({ error: 'Request timestamp too old' });
    }
    
    // Generate signature
    const { signature } = signRequest(payload, userId);
    
    return res.json({ signature });
  } catch (error) {
    console.error('Error signing request:', error);
    return res.status(500).json({ error: 'Failed to sign request' });
  }
});

// Apply signature verification to sensitive operations
v1Routes.post('/auth/change-password', auth, signatureMiddleware, async (req, res) => {
  // ... existing change password code ...
});

v1Routes.post('/auth/update-profile', auth, signatureMiddleware, async (req, res) => {
  // ... existing update profile code ...
});

v1Routes.post('/auth/enable-2fa', auth, signatureMiddleware, async (req, res) => {
  // ... existing enable 2FA code ...
});

v1Routes.post('/auth/verify-2fa', auth, signatureMiddleware, async (req, res) => {
  // ... existing verify 2FA code ...
});

v1Routes.post('/auth/disable-2fa', auth, signatureMiddleware, async (req, res) => {
  // ... existing disable 2FA code ...
});

// Authentication routes
// Login route with refresh token
v1Routes.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht' });
    }
    
    // Find the user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Ongeldige inloggegevens' });
    }
    
    // Check if the user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is gedeactiveerd' });
    }
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Ongeldige inloggegevens' });
    }
    
    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      return res.json({
        requiresTwoFactor: true,
        user: { id: user._id }
      });
    }
    
    // Generate access token
    const { token, jti, expiresIn } = generateAccessToken(user);
    
    // Generate refresh token
    const refreshToken = await generateRefreshToken(user._id);
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Success response
    return res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        company_id: user.company_id
      },
      token,
      refreshToken: refreshToken.token,
      expiresIn
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Er is een fout opgetreden tijdens het inloggen' });
  }
});

// Logout route that revokes refresh token
v1Routes.post('/auth/logout', auth, async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'No refresh token provided' });
    }
    
    // Revoke the refresh token
    await revokeRefreshToken(refreshToken);
    
    // Blacklist the access token
    const jti = req.user.jti;
    if (jti) {
      await addToBlacklist(jti, req.user.id);
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Error during logout' });
  }
});

// Refresh token route
v1Routes.post('/auth/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'No refresh token provided' });
    }
    
    const { accessToken, refreshToken: newRefreshToken, expiresIn } = await refreshAccessToken(refreshToken);
    
    return res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
      expiresIn
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Mount versioned routes
app.use('/api', v1Routes);
app.use('/api/v1', v1Routes); // Explicitly support v1

// Health check endpoint - not rate limited
app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});

// Auth endpoints with stricter rate limiting

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Running in ${process.env.NODE_ENV} mode`);
});

// Initialize scheduled tasks
// ... existing code ...
require('./src/cron/registrationReminders'); // Initialize registration reminders cron job
require('./src/cron/tokenMaintenance'); // Initialize token maintenance cron job

// Initialize player activity monitor
const PLAYER_OFFLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes in milliseconds
const checkOfflinePlayers = async () => {
  try {
    const offlineThreshold = new Date(Date.now() - PLAYER_OFFLINE_THRESHOLD);
    
    // Find all players marked as online that haven't sent a heartbeat recently
    const inactivePlayers = await Player.find({
      is_online: true,
      last_seen: { $lt: offlineThreshold }
    });
    
    if (inactivePlayers.length > 0) {
      secureLog.info(`Marking ${inactivePlayers.length} inactive players as offline`);
      
      // Update each player's status to offline
      const updatePromises = inactivePlayers.map(player => {
        player.is_online = false;
        return player.save();
      });
      
      await Promise.all(updatePromises);
      
      // Broadcast updates for each player
      inactivePlayers.forEach(player => {
        broadcastEvent('player_updated', player);
      });
    }
  } catch (error) {
    secureLog.error('Error checking for inactive players:', error);
  }
};

// Run every 30 seconds
setInterval(checkOfflinePlayers, 30 * 1000);

// Add player heartbeat endpoint
app.put('/api/players/:playerId/heartbeat', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    // Find player by device_id
    const player = await Player.findOne({ device_id: playerId });
    
    if (!player) {
      secureLog.warn(`Heartbeat received for unknown player: ${playerId}`);
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Update player status
    player.is_online = true;
    player.last_seen = new Date();
    
    // Update other fields if provided
    if (req.body) {
      if (req.body.current_url !== undefined) {
        player.current_url = req.body.current_url;
      }
    }
    
    await player.save();
    
    // Broadcast the update event
    broadcastEvent('player_updated', player);
    
    return res.json({ success: true });
  } catch (error) {
    secureLog.error('Error processing player heartbeat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});