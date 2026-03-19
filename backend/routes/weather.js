const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const weatherService = require('../services/weatherService');
const { query } = require('../config/db');

router.get('/zone/:zone_id', authMiddleware, async (req, res) => {
  try {
    const latest = await weatherService.getLatestWeather(req.params.zone_id);
    const history = await query(
      'SELECT * FROM weather_data WHERE zone_id = $1 ORDER BY recorded_at DESC LIMIT 48',
      [req.params.zone_id]
    );
    res.json({ success: true, latest, history: history.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch weather' });
  }
});

router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    await weatherService.refreshAllZones();
    res.json({ success: true, message: 'Weather data refreshed for all zones' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Refresh failed' });
  }
});

module.exports = router;
