const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const TriggerEngine = require('../services/triggerEngine');
const weatherService = require('../services/weatherService');
const deliveryService = require('../services/deliveryService');
const { query } = require('../config/db');

/**
 * POST /api/trigger/check
 * Manually trigger parametric check for a zone
 */
router.post('/check', authMiddleware, async (req, res) => {
  try {
    const { zone_id } = req.body;
    if (!zone_id) return res.status(400).json({ success: false, message: 'zone_id required' });

    const zoneResult = await query('SELECT * FROM zones WHERE id = $1', [zone_id]);
    const zone = zoneResult.rows[0];
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });

    const weatherData = await weatherService.getLatestWeather(zone_id);
    const volumeData = await deliveryService.getVolumeData(zone_id);

    const rainfallTriggered = weatherData.rainfall_mm >= 60;
    const volumeTriggered = volumeData.drop_percentage >= 40;

    res.json({
      success: true,
      zone: zone.name,
      trigger_status: {
        rainfall_mm: parseFloat(weatherData.rainfall_mm),
        rainfall_threshold: 60,
        rainfall_triggered: rainfallTriggered,
        volume_drop_pct: parseFloat(volumeData.drop_percentage),
        volume_threshold: 40,
        volume_triggered: volumeTriggered,
        overall_triggered: rainfallTriggered || volumeTriggered,
        trigger_type: rainfallTriggered && volumeTriggered ? 'combined'
          : rainfallTriggered ? 'rainfall'
          : volumeTriggered ? 'volume_drop' : 'none'
      }
    });
  } catch (err) {
    console.error('[TRIGGER] Check error:', err);
    res.status(500).json({ success: false, message: 'Trigger check failed' });
  }
});

/**
 * POST /api/trigger/simulate-flood
 * Demo: Simulate a flood event (injects fake weather data and triggers claims)
 */
router.post('/simulate-flood', adminMiddleware, async (req, res) => {
  try {
    const { zone_id } = req.body;
    if (!zone_id) return res.status(400).json({ success: false, message: 'zone_id required' });

    const zoneResult = await query('SELECT * FROM zones WHERE id = $1', [zone_id]);
    const zone = zoneResult.rows[0];

    // Inject flood weather data
    await query(`
      INSERT INTO weather_data (zone_id, rainfall_mm, rainfall_1h, rainfall_24h, flood_alert, data_source)
      VALUES ($1, 85, 30, 210, true, 'simulation')
    `, [zone_id]);

    // Inject volume drop
    const baseline = 180;
    const dropped = Math.round(baseline * 0.45);
    await query(`
      INSERT INTO delivery_volume_logs (zone_id, order_volume, baseline_volume, drop_percentage, is_anomaly)
      VALUES ($1, $2, $3, 55.0, true)
    `, [zone_id, dropped, baseline]);

    // Run trigger engine
    await TriggerEngine.checkZoneTriggers(zone);

    // Get generated claims
    const claims = await query(`
      SELECT c.*, u.full_name, u.phone
      FROM claims c
      JOIN users u ON u.id = c.user_id
      WHERE c.zone_id = $1 AND c.created_at > NOW() - INTERVAL '2 minutes'
    `, [zone_id]);

    res.json({
      success: true,
      message: `Flood simulation complete for ${zone.name}`,
      rainfall_injected: '85mm (threshold: 60mm)',
      volume_drop: '55% (threshold: 40%)',
      claims_generated: claims.rows.length,
      claims: claims.rows
    });
  } catch (err) {
    console.error('[SIMULATE] Error:', err);
    res.status(500).json({ success: false, message: 'Simulation failed' });
  }
});

module.exports = router;
