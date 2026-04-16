
const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { query } = require('../config/db');
const TrustEngine = require('../services/trustEngine');

/**
 * GET /api/trust/my
 * Get current rider's trust profile
 */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const profile = await TrustEngine.getTrustProfile(req.user.id);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, trust: profile });
  } catch (err) {
    console.error('[TRUST] Get profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to get trust profile' });
  }
});

/**
 * GET /api/trust/forecast/:zone_id
 * Get 48-hour risk forecast for a zone
 */
router.get('/forecast/:zone_id', authMiddleware, async (req, res) => {
  try {
    const { zone_id } = req.params;

    // Get zone info
    const zoneResult = await query('SELECT * FROM zones WHERE id = $1', [zone_id]);
    const zone = zoneResult.rows[0];
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });

    // Get forecasts
    const forecastResult = await query(`
      SELECT * FROM risk_forecasts
      WHERE zone_id = $1 AND forecast_date >= CURRENT_DATE
      ORDER BY forecast_date ASC
      LIMIT 3
    `, [zone_id]);

    // Get latest weather for context
    const weatherResult = await query(
      'SELECT * FROM weather_data WHERE zone_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [zone_id]
    );
    const currentWeather = weatherResult.rows[0];

    // If no forecasts in DB, generate dynamic ones
    let forecasts = forecastResult.rows;
    if (forecasts.length === 0) {
      const riskScore = parseFloat(zone.flood_risk_score);
      forecasts = [
        {
          forecast_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          risk_level: riskScore >= 8 ? 'HIGH' : riskScore >= 6 ? 'MEDIUM' : 'LOW',
          predicted_rainfall_mm: (riskScore * 8.5).toFixed(1),
          confidence_pct: 68,
          disruption_probability: (riskScore / 10).toFixed(2),
          recommended_coverage: riskScore >= 7 ? 'demand' : 'weekly'
        },
        {
          forecast_date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
          risk_level: riskScore >= 7 ? 'EXTREME' : 'HIGH',
          predicted_rainfall_mm: (riskScore * 11).toFixed(1),
          confidence_pct: 54,
          disruption_probability: Math.min(riskScore / 10 * 1.3, 0.95).toFixed(2),
          recommended_coverage: 'weekly'
        }
      ];
    }

    // Build alert message
    const maxRisk = forecasts.reduce((max, f) => {
      const levels = { LOW: 1, MEDIUM: 2, HIGH: 3, EXTREME: 4 };
      return levels[f.risk_level] > levels[max] ? f.risk_level : max;
    }, 'LOW');

    const alertMessages = {
      EXTREME: `🚨 EXTREME FLOOD RISK in ${zone.name} next 48 hours. Activate weekly coverage NOW before surge pricing.`,
      HIGH: `⚠️ HIGH flood risk predicted for ${zone.name}. Consider buying coverage before the storm hits.`,
      MEDIUM: `🌧️ Moderate rain expected in ${zone.name}. Monitor weather and consider on-demand coverage.`,
      LOW: `☀️ Low disruption risk in ${zone.name} for next 48 hours. Normal conditions expected.`
    };

    res.json({
      success: true,
      zone_name: zone.name,
      flood_risk_score: zone.flood_risk_score,
      current_rainfall_mm: currentWeather ? parseFloat(currentWeather.rainfall_mm) : 0,
      alert_level: maxRisk,
      alert_message: alertMessages[maxRisk],
      forecasts,
      recommendation: forecasts[0]?.recommended_coverage || 'none',
      surge_warning: maxRisk === 'EXTREME' || maxRisk === 'HIGH'
    });
  } catch (err) {
    console.error('[TRUST] Forecast error:', err);
    res.status(500).json({ success: false, message: 'Failed to get forecast' });
  }
});

/**
 * GET /api/trust/leaderboard
 * Top trusted riders (gamification)
 */
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        u.full_name, u.platform, u.trust_score, u.trust_level,
        u.claim_free_weeks, z.name as zone_name,
        RANK() OVER (ORDER BY u.trust_score DESC) as rank
      FROM users u
      LEFT JOIN zones z ON z.id = u.zone_id
      WHERE u.phone != '9999999999' AND u.is_active = true
      ORDER BY u.trust_score DESC
      LIMIT 10
    `);

    res.json({ success: true, leaderboard: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get leaderboard' });
  }
});

/**
 * GET /api/trust/admin-analytics
 * Admin: Predictive analytics for next week
 */
router.get('/admin-analytics', adminMiddleware, async (req, res) => {
  try {
    // Zone risk predictions for next 7 days
    const zoneRisks = await query(`
      SELECT 
        z.name, z.flood_risk_score, z.zone_multiplier,
        COUNT(DISTINCT u.id) as riders_at_risk,
        COUNT(DISTINCT p.id) as active_policies,
        SUM(p.coverage_amount) as total_exposure,
        COALESCE((SELECT rainfall_mm FROM weather_data WHERE zone_id = z.id ORDER BY recorded_at DESC LIMIT 1), 0) as current_rainfall
      FROM zones z
      LEFT JOIN users u ON u.zone_id = z.id AND u.is_active = true
      LEFT JOIN policies p ON p.zone_id = z.id AND p.status = 'active'
      GROUP BY z.id
      ORDER BY z.flood_risk_score DESC
    `);

    // Trust score distribution
    const trustDistribution = await query(`
      SELECT 
        CASE 
          WHEN trust_score >= 85 THEN 'Elite (85-100)'
          WHEN trust_score >= 65 THEN 'Trusted (65-84)'
          WHEN trust_score >= 45 THEN 'Good (45-64)'
          WHEN trust_score >= 25 THEN 'Building (25-44)'
          ELSE 'New (0-24)'
        END as trust_band,
        COUNT(*) as rider_count,
        ROUND(AVG(trust_score)) as avg_score
      FROM users
      WHERE phone != '9999999999'
      GROUP BY trust_band
      ORDER BY avg_score DESC
    `);

    // Predicted claims for next week based on weather forecasts
    const predictedClaims = await query(`
      SELECT 
        z.name as zone_name,
        rf.risk_level,
        rf.predicted_rainfall_mm,
        rf.disruption_probability,
        COUNT(DISTINCT p.id) as policies_at_risk,
        ROUND(COUNT(DISTINCT p.id) * rf.disruption_probability) as predicted_claims,
        ROUND(SUM(p.coverage_amount) * rf.disruption_probability * 0.75) as predicted_payout
      FROM risk_forecasts rf
      JOIN zones z ON z.id = rf.zone_id
      LEFT JOIN policies p ON p.zone_id = z.id AND p.status = 'active'
      WHERE rf.forecast_date = CURRENT_DATE + 1
      GROUP BY z.name, rf.risk_level, rf.predicted_rainfall_mm, rf.disruption_probability
      ORDER BY rf.disruption_probability DESC
    `);

    // Fraud risk summary
    const fraudSummary = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE trust_score < 25) as high_risk_riders,
        COUNT(*) FILTER (WHERE trust_score BETWEEN 25 AND 44) as medium_risk_riders,
        COUNT(*) FILTER (WHERE trust_score >= 45) as low_risk_riders,
        ROUND(AVG(trust_score)) as platform_avg_trust
      FROM users WHERE phone != '9999999999'
    `);

    res.json({
      success: true,
      analytics: {
        zone_risk_map: zoneRisks.rows,
        trust_distribution: trustDistribution.rows,
        predicted_claims_tomorrow: predictedClaims.rows,
        fraud_risk_summary: fraudSummary.rows[0],
        generated_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[TRUST] Admin analytics error:', err);
    res.status(500).json({ success: false, message: 'Analytics failed' });
  }
});

/**
 * POST /api/trust/simulate-week
 * Admin: Simulate weekly trust update (demo)
 */
router.post('/simulate-week', adminMiddleware, async (req, res) => {
  try {
    await TrustEngine.processWeeklyUpdates();
    res.json({ success: true, message: 'Weekly trust scores updated for all riders' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Simulation failed' });
  }
});

module.exports = router;
