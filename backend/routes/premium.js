const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/db');
const axios = require('axios');

/**
 * GET /api/premium/calculate
 * AI-powered weekly premium calculation
 * Premium = BaseRate + (FloodRiskScore × ZoneMultiplier) - SafetyDiscount
 */
router.get('/calculate', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { zone_id, coverage_amount = 2000 } = req.query;

    // Fetch user and zone data
    const userResult = await query(
      'SELECT u.*, z.flood_risk_score, z.zone_multiplier, z.name as zone_name FROM users u JOIN zones z ON z.id = u.zone_id WHERE u.id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    const targetZoneId = zone_id || user.zone_id;

    const zoneResult = await query('SELECT * FROM zones WHERE id = $1', [targetZoneId]);
    const zone = zoneResult.rows[0];

    // Fetch latest weather
    const weatherResult = await query(
      'SELECT * FROM weather_data WHERE zone_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [targetZoneId]
    );
    const weather = weatherResult.rows[0] || { rainfall_mm: 0, rainfall_24h: 0 };

    // Fetch past claims for discount calculation
    const claimsResult = await query(
      "SELECT COUNT(*) as count FROM claims WHERE user_id = $1 AND status != 'fraud_hold'",
      [userId]
    );

    // Call ML service for premium calculation
    let mlPremium = null;
    try {
      const mlResponse = await axios.post(`${process.env.ML_SERVICE_URL}/calculate-premium`, {
        flood_risk_score: parseFloat(zone.flood_risk_score),
        zone_multiplier: parseFloat(zone.zone_multiplier),
        coverage_amount: parseFloat(coverage_amount),
        rider_risk_score: parseFloat(user.risk_score || 5.0),
        rainfall_mm: parseFloat(weather.rainfall_mm || 0),
        rainfall_24h: parseFloat(weather.rainfall_24h || 0),
        past_claims: parseInt(claimsResult.rows[0].count)
      }, { timeout: 3000 });
      mlPremium = mlResponse.data;
    } catch (mlErr) {
      console.warn('[PREMIUM] ML service unavailable, using fallback formula');
    }

    // Fallback formula calculation
    const baseRate = parseFloat(coverage_amount) * 0.03; // 3% base
    const floodRiskScore = parseFloat(zone.flood_risk_score);
    const zoneMultiplier = parseFloat(zone.zone_multiplier);
    const pastClaims = parseInt(claimsResult.rows[0].count);

    // Safety discount: max 20% for no claims
    const safetyDiscount = Math.min(pastClaims === 0 ? baseRate * 0.20 : 0, baseRate * 0.10);

    const calculatedPremium = mlPremium
      ? mlPremium.weekly_premium
      : Math.round((baseRate + (floodRiskScore * zoneMultiplier) - safetyDiscount) * 100) / 100;

    const breakdown = {
      base_rate: Math.round(baseRate * 100) / 100,
      flood_risk_score: floodRiskScore,
      zone_multiplier: zoneMultiplier,
      risk_component: Math.round(floodRiskScore * zoneMultiplier * 100) / 100,
      safety_discount: Math.round(safetyDiscount * 100) / 100,
      weekly_premium: calculatedPremium,
      coverage_amount: parseFloat(coverage_amount),
      zone_name: zone.name,
      ml_powered: !!mlPremium,
      rainfall_factor: weather.rainfall_mm > 30 ? 'HIGH' : weather.rainfall_mm > 10 ? 'MEDIUM' : 'LOW'
    };

    res.json({ success: true, premium: breakdown });
  } catch (err) {
    console.error('[PREMIUM] Calculate error:', err);
    res.status(500).json({ success: false, message: 'Premium calculation failed' });
  }
});

module.exports = router;
