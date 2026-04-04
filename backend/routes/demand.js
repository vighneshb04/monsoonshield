const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/db');

/**
 * Coverage on Demand — Hourly micro-insurance
 * Rider activates storm coverage for 1, 3, or 6 hours
 * Pricing: ₹4/hr base × zone_multiplier
 */

const HOURLY_BASE_RATE = 4; // ₹4 per hour base
const COVERAGE_PER_HOUR = 200; // ₹200 coverage per hour

/**
 * GET /api/demand/pricing
 * Get pricing options for current zone
 */
router.get('/pricing', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await query(
      'SELECT u.*, z.zone_multiplier, z.flood_risk_score, z.name as zone_name FROM users u JOIN zones z ON z.id = u.zone_id WHERE u.id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    const multiplier = parseFloat(user.zone_multiplier);
    const riskScore = parseFloat(user.flood_risk_score);

    // Check if already has active demand coverage
    const activeResult = await query(
      "SELECT * FROM demand_coverage WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()",
      [userId]
    );
    const activeCoverage = activeResult.rows[0] || null;

    // Get current weather
    const weatherResult = await query(
      'SELECT * FROM weather_data WHERE zone_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [user.zone_id]
    );
    const weather = weatherResult.rows[0];
    const rainfall = parseFloat(weather?.rainfall_mm || 0);

    // Dynamic pricing based on current weather risk
    const weatherSurcharge = rainfall > 30 ? 1.5 : rainfall > 15 ? 1.2 : 1.0;

    const packages = [
      {
        hours: 1,
        label: '1 Hour',
        emoji: '⚡',
        premium: Math.round(HOURLY_BASE_RATE * multiplier * weatherSurcharge * 1 * 100) / 100,
        coverage: COVERAGE_PER_HOUR * 1,
        description: 'Quick protection for a short ride'
      },
      {
        hours: 3,
        label: '3 Hours',
        emoji: '🌧️',
        premium: Math.round(HOURLY_BASE_RATE * multiplier * weatherSurcharge * 3 * 0.9 * 100) / 100,
        coverage: COVERAGE_PER_HOUR * 3,
        description: 'Most popular — covers a full work session',
        popular: true
      },
      {
        hours: 6,
        label: '6 Hours',
        emoji: '⛈️',
        premium: Math.round(HOURLY_BASE_RATE * multiplier * weatherSurcharge * 6 * 0.8 * 100) / 100,
        coverage: COVERAGE_PER_HOUR * 6,
        description: 'Full day storm protection'
      }
    ];

    res.json({
      success: true,
      zone_name: user.zone_name,
      flood_risk_score: riskScore,
      current_rainfall_mm: rainfall,
      weather_surcharge: weatherSurcharge > 1 ? `${((weatherSurcharge - 1) * 100).toFixed(0)}% storm surcharge applied` : null,
      storm_risk: rainfall > 30 ? 'HIGH' : rainfall > 15 ? 'MEDIUM' : 'LOW',
      packages,
      active_coverage: activeCoverage
    });
  } catch (err) {
    console.error('[DEMAND] Pricing error:', err);
    res.status(500).json({ success: false, message: 'Failed to get pricing' });
  }
});

/**
 * POST /api/demand/activate
 * Activate on-demand coverage for N hours
 */
router.post('/activate', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { hours } = req.body;

    if (![1, 3, 6].includes(parseInt(hours))) {
      return res.status(400).json({ success: false, message: 'Invalid hours. Choose 1, 3, or 6' });
    }

    // Check existing active coverage
    const existing = await query(
      "SELECT id FROM demand_coverage WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()",
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'You already have active on-demand coverage' });
    }

    const userResult = await query(
      'SELECT u.*, z.zone_multiplier, z.flood_risk_score, z.name as zone_name FROM users u JOIN zones z ON z.id = u.zone_id WHERE u.id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    const multiplier = parseFloat(user.zone_multiplier);

    const weatherResult = await query(
      'SELECT rainfall_mm FROM weather_data WHERE zone_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [user.zone_id]
    );
    const rainfall = parseFloat(weatherResult.rows[0]?.rainfall_mm || 0);
    const weatherSurcharge = rainfall > 30 ? 1.5 : rainfall > 15 ? 1.2 : 1.0;

    const discountMap = { 1: 1.0, 3: 0.9, 6: 0.8 };
    const premium = Math.round(HOURLY_BASE_RATE * multiplier * weatherSurcharge * hours * discountMap[hours] * 100) / 100;
    const coverageAmount = COVERAGE_PER_HOUR * hours;

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const result = await query(`
      INSERT INTO demand_coverage (user_id, zone_id, duration_hours, premium_paid, coverage_amount, expires_at, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      RETURNING *
    `, [userId, user.zone_id, hours, premium, coverageAmount, expiresAt]);

    const coverage = result.rows[0];

    res.json({
      success: true,
      message: `✅ ${hours}-hour storm coverage activated!`,
      coverage: {
        id: coverage.id,
        hours,
        premium_paid: premium,
        coverage_amount: coverageAmount,
        activated_at: coverage.activated_at,
        expires_at: expiresAt,
        zone_name: user.zone_name,
        status: 'active'
      },
      payout_trigger: 'Rainfall > 60mm in your zone within coverage window',
      estimated_payout: `₹${coverageAmount} if triggered`
    });
  } catch (err) {
    console.error('[DEMAND] Activate error:', err);
    res.status(500).json({ success: false, message: 'Activation failed' });
  }
});

/**
 * GET /api/demand/my
 * Get user's demand coverage history
 */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    // Auto-expire old coverages
    await query(
      "UPDATE demand_coverage SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()"
    );

    const result = await query(`
      SELECT dc.*, z.name as zone_name
      FROM demand_coverage dc
      JOIN zones z ON z.id = dc.zone_id
      WHERE dc.user_id = $1
      ORDER BY dc.created_at DESC
      LIMIT 20
    `, [req.user.id]);

    res.json({ success: true, coverages: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch coverages' });
  }
});

/**
 * POST /api/demand/cancel/:id
 * Cancel active coverage (no refund — simulated)
 */
router.post('/cancel/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      "UPDATE demand_coverage SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status = 'active' RETURNING *",
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Active coverage not found' });
    res.json({ success: true, message: 'Coverage cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cancel failed' });
  }
});

module.exports = router;
