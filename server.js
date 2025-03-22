import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import Mailjet from 'node-mailjet';
import crypto from 'crypto';
import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import User from './src/models/User.js';
import Company from './src/models/Company.js';
import { sendPasswordResetEmail, sendRegistrationInvitationEmail } from './src/services/emailService.js';
import './src/cron/registrationReminders.js'; // Initialize registration reminders cron job
import { validatePassword } from './src/utils/passwordValidation.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// Initialize Mailjet if credentials are provided
let mailjet;
if (process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY) {
  mailjet = new Mailjet({
    apiKey: process.env.MAILJET_API_KEY,
    apiSecret: process.env.MAILJET_SECRET_KEY
  });
  console.log('Mailjet client initialized successfully');
} else {
  console.log('Mailjet credentials not found, email functionality will be unavailable');
}

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow any localhost origin during development
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configure body parser with explicit limits and types
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Simple authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    console.log('No token provided in request');
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    console.log('Decoded token:', { ...decoded, id: decoded.id }); // Log decoded token info (excluding sensitive data)
    
    // Ensure required user information is present
    if (!decoded.role || !decoded.email) {
      console.log('Token missing required user information');
      return res.status(403).json({ error: 'Invalid token format' });
    }
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      company_id: decoded.company_id
    };
    
    next();
  } catch (error) {
    console.log('Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// MongoDB connection is required
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is required but not provided in environment variables');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('✅ MongoDB connected successfully');
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.error('MongoDB connection is required for the application to work');
    process.exit(1);
  });

// Define MongoDB models
const PlayerSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  device_id: { type: String, required: true, unique: true },
  company_id: { type: String, required: true },
  current_url: String,
  is_online: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const CommandSchema = new mongoose.Schema({
  player_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Player' },
  command_type: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  completed_at: { type: Date }
});

const Player = mongoose.model('Player', PlayerSchema);
const Command = mongoose.model('Command', CommandSchema);

// WebSocket connection handling
wss.on('connection', function connection(ws, req) {
  // Authenticate the connection
  authenticateWSConnection(req, (err) => {
    if (err) {
      ws.terminate();
      return;
    }
    
    console.log('New WebSocket connection authenticated');
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    // Handle incoming messages
    ws.on('message', function incoming(message) {
      try {
        const parsedMessage = JSON.parse(message);
        if (!validateMessage(parsedMessage)) {
          console.error('Invalid message format');
          return;
        }
        
        // Handle different message types
        switch (parsedMessage.type) {
          case 'status_update':
            handleStatusUpdate(parsedMessage.data);
            break;
          case 'command_response':
            handleCommandResponse(parsedMessage.data);
            break;
          default:
            console.log('Unknown message type:', parsedMessage.type);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', function() {
      console.log('Client disconnected');
    });
  });
});

// Set up the heartbeat interval
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', function close() {
  clearInterval(interval);
});

// Helper functions
function heartbeat() {
  this.isAlive = true;
}

// Broadcast function to send updates to all connected clients
const broadcastEvent = (eventType, data) => {
  const message = JSON.stringify({ type: eventType, data });
  
  wss.clients.forEach((client, ws) => {
    // Only send to authenticated clients
    if (!client.user) return;
    
    // Filter messages based on user role and company
    if (client.user.role !== 'superadmin') {
      // For company events, only superadmin receives all updates
      if (eventType.startsWith('company_')) {
        return;
      }
      
      // For player events, only send if it's for their company
      if (eventType.startsWith('player_') && 
          data.company_id !== client.user.company_id) {
        return;
      }
    }
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
};

// WebSocket authentication middleware
const authenticateWSConnection = (req, callback) => {
  const token = req.headers['sec-websocket-protocol'];
  
  if (!token) {
    console.log('WebSocket connection rejected: No token provided');
    callback(new Error('Unauthorized'));
    return;
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    req.user = decoded;
    callback(null);
  } catch (error) {
    console.log('WebSocket connection rejected: Invalid token');
    callback(new Error('Unauthorized'));
  }
};

// Message validation
const validateMessage = (message) => {
  // Validate message structure
  if (!message || typeof message !== 'object') {
    return false;
  }

  // Validate message type
  if (!message.type || typeof message.type !== 'string') {
    return false;
  }

  // Validate specific message types
  switch (message.type) {
    case 'status_update':
      return message.data && typeof message.data === 'object';
    case 'command_response':
      return message.data && typeof message.data === 'object' && 
             typeof message.data.commandId === 'string';
    default:
      return false;
  }
};

// Handle status update messages
const handleStatusUpdate = (data) => {
  // Implement status update logic
  console.log('Status update received:', data);
};

// Handle command response messages
const handleCommandResponse = (data) => {
  // Implement command response logic
  console.log('Command response received:', data);
};

// API Routes

// Company routes
app.get('/api/companies', async (req, res) => {
  try {
    let userData = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      try {
        userData = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
      } catch (error) {
        // Continue without authentication
      }
    }
    
    // If user is not superadmin, only return their company
    if (userData && userData.role !== 'superadmin' && userData.company_id) {
      const company = await Company.findOne({ company_id: userData.company_id });
      return res.json(company ? [company] : []);
    }
    
    // Otherwise return all companies
    const companies = await Company.find().sort({ company_name: 1 });
    return res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/companies', authenticateToken, async (req, res) => {
  try {
    // Only superadmin can create companies
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can create companies' });
    }
    
    // Check if company with this ID already exists
    const existingCompany = await Company.findOne({ company_id: req.body.company_id });
    if (existingCompany) {
      return res.status(400).json({ error: `Company with ID "${req.body.company_id}" already exists` });
    }
    
    // Create new company
    const company = new Company(req.body);
    await company.save();
    broadcastEvent('company_created', company);
    return res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/companies/:id', authenticateToken, async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    broadcastEvent('company_updated', company);
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/companies/:id', authenticateToken, async (req, res) => {
  try {
    await Company.findByIdAndDelete(req.params.id);
    broadcastEvent('company_deleted', { id: req.params.id });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Player routes
app.get('/api/players', async (req, res) => {
  try {
    let userData = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      try {
        userData = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
      } catch (error) {
        // Continue without authentication
      }
    }
    
    const { company_id } = req.query;
    let query = {};
    
    // If company_id is provided or user is not superadmin, filter by company
    if (company_id || (userData && userData.role !== 'superadmin' && userData.company_id)) {
      query.company_id = company_id || userData.company_id;
    }
    
    const players = await Player.find(query).sort({ device_id: 1 });
    return res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/players', authenticateToken, async (req, res) => {
  try {
    const { device_id, company_id } = req.body;
    
    // Validate required fields
    if (!device_id || !company_id) {
      return res.status(400).json({ error: 'Device ID and Company ID are required' });
    }
    
    // If user is not superadmin, they can only create players for their own company
    if (req.user.role !== 'superadmin' && req.user.company_id !== company_id) {
      return res.status(403).json({ error: 'You can only create players for your own company' });
    }
    
    // Check if player with this device_id already exists
    const existingPlayer = await Player.findOne({ device_id });
    if (existingPlayer) {
      return res.status(400).json({ error: `Player with device ID "${device_id}" already exists` });
    }
    
    // Create new player
    const player = new Player({
      device_id,
      company_id,
      current_url: req.body.current_url || '',
      is_online: req.body.is_online || false
    });
    
    await player.save();
    broadcastEvent('player_created', player);
    return res.status(201).json(player);
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/players/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const player = await Player.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    broadcastEvent('player_updated', player);
    return res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a player
app.delete('/api/players/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid player ID format' });
    }
    
    // Check if player exists
    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // If user is not superadmin, they can only delete players from their own company
    if (req.user.role !== 'superadmin' && req.user.company_id !== player.company_id) {
      return res.status(403).json({ error: 'You can only delete players from your own company' });
    }
    
    // Delete the player
    await Player.findByIdAndDelete(id);
    
    // Also delete any associated commands
    await Command.deleteMany({ player_id: id });
    
    broadcastEvent('player_deleted', { id });
    return res.status(200).json({ message: 'Player deleted successfully' });
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
app.get('/api/users', async (req, res) => {
  try {
    let userData = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      try {
        userData = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
      } catch (error) {
        // Continue without authentication
      }
    }
    
    const { company_id } = req.query;
    let query = {};
    
    // If company_id is provided or user is not superadmin, filter by company
    if (company_id || (userData && userData.role !== 'superadmin' && userData.company_id)) {
      query.company_id = company_id || userData.company_id;
    }
    
    const users = await User.find(query).sort({ email: 1 });
    return res.json(users);
  } catch (error) {
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

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user in MongoDB
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    if (!user.verifyPassword(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '24h' }
    );

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
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

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
    user.setPassword(password);
    user.isActive = true;
    user.registrationToken = undefined;
    user.registrationTokenExpires = undefined;
    
    await user.save();
    
    console.log('✅ User registration completed:', { email, role: user.role });

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '24h' }
    );

    return res.status(201).json({
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
      return res.status(400).json({
        error: 'Email is required',
        field: 'email',
        message: 'Voer een e-mailadres in'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        field: 'email',
        message: 'Voer een geldig e-mailadres in'
      });
    }

    console.log(`📧 Processing password reset for email: ${email.toLowerCase()}`);

    // Rate limiting check (you might want to implement a proper rate limiter)
    const rateLimitKey = `pwd_reset_${email.toLowerCase()}`;
    // TODO: Implement rate limiting here if needed

    // Find user in MongoDB
    const user = await User.findOne({ email: email.toLowerCase() });

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
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Er is recent al een reset link verzonden. Wacht enkele minuten voordat je het opnieuw probeert.',
        retryAfter: Math.ceil((user.resetPasswordExpires.getTime() - Date.now() - (60 * 60 * 1000 - cooldownPeriod)) / 1000)
      });
    }

    // Generate reset token
    const resetToken = user.generateResetToken();
    await user.save();

    console.log(`✅ Reset token generated for user: ${email}`);

    // Send the email
    const emailResult = await sendPasswordResetEmail(email, resetToken);
    
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
  } catch (error) {
    console.error('❌ Password reset error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.'
    });
  }
});

// Password reset endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    console.log('🔐 Password reset endpoint hit with body:', req.body);
    const { token, password } = req.body;
    
    if (!token || !password) {
      console.log('⚠️ Missing token or password in request');
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Validate token format (40 characters hex)
    if (!/^[a-f0-9]{40}$/.test(token)) {
      console.log('❌ Invalid token format:', token);
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Validate password strength
    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        passwordErrors: errors
      });
    }

    // Find user with matching reset token that hasn't expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log('❌ No user found with valid token:', token);
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    console.log(`✅ User found with token: ${user.email}`);

    // Update password
    user.setPassword(password);
    
    // Clear reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
    console.log(`🔑 Password updated for user: ${user.email}`);
    
    // Generate new JWT token for automatic login
    const jwtToken = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '24h' }
    );

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
app.post('/api/auth/register-invitation', authenticateToken, async (req, res) => {
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
    
    res.json({ message: 'Invitation sent successfully' });
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
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      // Set password and activate account
      user.setPassword(password);
    } else {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Save the updated user
    await user.save();
    console.log(`✅ Registration completed for user: ${user.email}`);

    // Generate JWT token for automatic login
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '24h' }
    );

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
    console.error('❌ Complete registration error:', error);
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
    console.log('🔍 Verify token request received');
    console.log('Query parameters:', req.query);

    if (!token) {
      console.log('❌ No token provided in verify-token request');
      return res.status(400).json({ error: 'Token is required' });
    }

    console.log('🔑 Verifying token:', token);

    // Find user with valid registration token
    console.log('📝 Querying MongoDB with:', {
      registrationToken: token,
      registrationTokenExpires: { $gt: Date.now() },
      isActive: false
    });

    const user = await User.findOne({
      registrationToken: token,
      registrationTokenExpires: { $gt: Date.now() },
      isActive: false
    });

    console.log('📝 MongoDB query result:', user ? {
      id: user._id,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      isActive: user.isActive,
      registrationToken: user.registrationToken,
      registrationTokenExpires: user.registrationTokenExpires
    } : 'No user found');

    if (!user) {
      console.log('❌ No user found with token:', token);
      return res.status(400).json({ error: 'Invalid or expired registration token' });
    }

    console.log('✅ Found user:', {
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      isActive: user.isActive,
      tokenExpires: user.registrationTokenExpires
    });

    // Get company name if company_id exists
    let company_name = '';
    if (user.company_id) {
      console.log('🏢 Looking up company with ID:', user.company_id);
      const company = await Company.findOne({ company_id: user.company_id });
      if (company) {
        company_name = company.company_name;
        console.log('✅ Found company:', company_name);
      } else {
        console.log('⚠️ Company not found for ID:', user.company_id);
      }
    }

    // Return user info without sensitive data
    const response = {
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      company_name
    };
    console.log('📤 Sending response:', response);

    return res.json(response);
  } catch (error) {
    console.error('❌ Token verification error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test route
app.get('/api/users/test', (req, res) => {
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
    if (!user.verifyPassword(currentPassword)) {
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
    user.setPassword(newPassword);
    await user.save();
    console.log('Password updated successfully for user:', user.email);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});