/**
 * MonsoonShield AI - Main Server
 * Hyperlocal Weekly Income Protection for Mumbai Q-Commerce Riders
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use('/api/', limiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/zones',     require('./routes/zones'));
app.use('/api/policy',    require('./routes/policy'));
app.use('/api/premium',   require('./routes/premium'));
app.use('/api/trigger',   require('./routes/trigger'));
app.use('/api/claim',     require('./routes/claim'));
app.use('/api/payout',    require('./routes/payout'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/weather',   require('./routes/weather'));
app.use('/api/demand', require('./routes/demand'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'MonsoonShield Backend', timestamp: new Date().toISOString() });
});

// ─── Cron Jobs ────────────────────────────────────────────────────────────────
const TriggerEngine = require('./services/triggerEngine');

// Check parametric triggers every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('[CRON] Running parametric trigger check...');
  await TriggerEngine.runTriggerCheck();
});

// Weather data refresh every hour
cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Refreshing weather data...');
  const weatherService = require('./services/weatherService');
  await weatherService.refreshAllZones();
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ MonsoonShield Backend running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   ML Service:  ${process.env.ML_SERVICE_URL}`);
});

module.exports = app;
