const commandRoutes = require('./commands');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const companyRoutes = require('./companies');
const scheduleRoutes = require('./schedules');
const groupRoutes = require('./groups');
const healthRoutes = require('./health');
const playerRoutes = require('./players');
const publicRoutes = require('./public');
const formPlayerRoutes = require('./formPlayers');
const { createMonitoringRouter } = require('./monitoring');

function registerApiRoutes(app, options = {}) {
  app.get('/api', (req, res) => {
    res.json({ message: 'API is running' });
  });

  app.use('/api/commands', commandRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/health-data', healthRoutes);
  app.use('/api/players', playerRoutes);
  app.use('/api/player', playerRoutes);
  app.use('/api/v1/commands', commandRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/companies', companyRoutes);
  app.use('/api/v1/schedules', scheduleRoutes);
  app.use('/api/v1/groups', groupRoutes);
  app.use('/api/v1/health-data', healthRoutes);
  app.use('/api/v1/players', playerRoutes);
  app.use('/api/v1/player', playerRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/v1/public', publicRoutes);
  app.use('/', formPlayerRoutes);
  app.use('/api/monitoring', createMonitoringRouter(options));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  app.get('/api/status', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/v1/status', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/ping', (req, res) => {
    res.status(200).send('pong');
  });

  app.get('/api/v1/ping', (req, res) => {
    res.status(200).send('pong');
  });
}

module.exports = { registerApiRoutes };
