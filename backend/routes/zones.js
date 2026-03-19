const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

/**
 * GET /api/zones
 * Get all active zones with risk data
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        z.*,
        COUNT(DISTINCT u.id) as rider_count,
        COUNT(DISTINCT p.id) as active_policies,
        COALESCE(
          (SELECT rainfall_mm FROM weather_data 
           WHERE zone_id = z.id 
           ORDER BY recorded_at DESC LIMIT 1), 0
        ) as latest_rainfall,
        COALESCE(
          (SELECT flood_alert FROM weather_data 
           WHERE zone_id = z.id 
           ORDER BY recorded_at DESC LIMIT 1), false
        ) as flood_alert
      FROM zones z
      LEFT JOIN users u ON u.zone_id = z.id AND u.is_active = true
      LEFT JOIN policies p ON p.zone_id = z.id AND p.status = 'active'
      WHERE z.is_active = true
      GROUP BY z.id
      ORDER BY z.flood_risk_score DESC
    `);

    res.json({ success: true, zones: result.rows });
  } catch (err) {
    console.error('[ZONES] Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch zones' });
  }
});

/**
 * GET /api/zones/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT z.*,
        (SELECT json_agg(wd ORDER BY wd.recorded_at DESC) 
         FROM (SELECT * FROM weather_data WHERE zone_id = z.id 
               ORDER BY recorded_at DESC LIMIT 24) wd
        ) as recent_weather
      FROM zones z WHERE z.id = $1
    `, [req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Zone not found' });
    res.json({ success: true, zone: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch zone' });
  }
});

module.exports = router;
