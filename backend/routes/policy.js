const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/db');

function generatePolicyNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `MSH-${year}-${rand}`;
}

/**
 * POST /api/policy/create
 * Create a new weekly policy
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { zone_id, coverage_amount = 2000, weekly_premium } = req.body;

    if (!zone_id || !weekly_premium) {
      return res.status(400).json({ success: false, message: 'zone_id and weekly_premium required' });
    }

    // Check if active policy exists
    const existing = await query(
      "SELECT id FROM policies WHERE user_id = $1 AND status = 'active' AND end_date >= CURRENT_DATE",
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Active policy already exists for this week' });
    }

    const policy_number = generatePolicyNumber();
    const start_date = new Date();
    const end_date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await query(`
      INSERT INTO policies (user_id, zone_id, policy_number, coverage_amount, weekly_premium, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [userId, zone_id, policy_number, coverage_amount, weekly_premium, start_date, end_date]);

    const policy = result.rows[0];

    // Log premium history
    await query(`
      INSERT INTO premium_history (policy_id, user_id, week_start, week_end, base_rate, flood_risk_score, zone_multiplier, final_premium, payment_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'paid')
    `, [policy.id, userId, start_date, end_date,
        parseFloat(weekly_premium) * 0.6,  // approx base
        5.0, 1.5,
        parseFloat(weekly_premium)
    ]);

    res.status(201).json({
      success: true,
      message: 'Policy created successfully',
      policy: {
        ...policy,
        coverage_amount: parseFloat(policy.coverage_amount),
        weekly_premium: parseFloat(policy.weekly_premium)
      }
    });
  } catch (err) {
    console.error('[POLICY] Create error:', err);
    res.status(500).json({ success: false, message: 'Policy creation failed' });
  }
});

/**
 * GET /api/policy/my
 * Get current user's policies
 */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, z.name as zone_name, z.flood_risk_score,
        (SELECT COUNT(*) FROM claims c WHERE c.policy_id = p.id) as claims_count
      FROM policies p
      JOIN zones z ON z.id = p.zone_id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
    `, [req.user.id]);

    res.json({ success: true, policies: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch policies' });
  }
});

module.exports = router;
