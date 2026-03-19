const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { query } = require('../config/db');

/**
 * GET /api/dashboard/worker
 * Rider's personal dashboard
 */
router.get('/worker', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // User profile with zone
    const userResult = await query(`
      SELECT u.*, z.name as zone_name, z.flood_risk_score, z.zone_multiplier
      FROM users u LEFT JOIN zones z ON z.id = u.zone_id
      WHERE u.id = $1
    `, [userId]);
    const user = userResult.rows[0];

    // Active policy
    const policyResult = await query(`
      SELECT * FROM policies WHERE user_id = $1 AND status = 'active' AND end_date >= CURRENT_DATE
      ORDER BY created_at DESC LIMIT 1
    `, [userId]);
    const activePolicy = policyResult.rows[0] || null;

    // Claims summary
    const claimsResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COALESCE(SUM(claim_amount) FILTER (WHERE status = 'paid'), 0) as total_received
      FROM claims WHERE user_id = $1
    `, [userId]);
    const claimsSummary = claimsResult.rows[0];

    // Recent claims (last 5)
    const recentClaims = await query(`
      SELECT c.*, z.name as zone_name, pay.payout_number, pay.status as payout_status
      FROM claims c
      JOIN zones z ON z.id = c.zone_id
      LEFT JOIN payouts pay ON pay.claim_id = c.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC LIMIT 5
    `, [userId]);

    // Latest weather in user's zone
    const weatherResult = await query(`
      SELECT * FROM weather_data WHERE zone_id = $1
      ORDER BY recorded_at DESC LIMIT 1
    `, [user.zone_id]);
    const weather = weatherResult.rows[0] || null;

    // Total premiums paid
    const premiumResult = await query(
      'SELECT COALESCE(SUM(final_premium), 0) as total FROM premium_history WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      dashboard: {
        user: {
          id: user.id,
          full_name: user.full_name,
          phone: user.phone,
          platform: user.platform,
          zone_name: user.zone_name,
          flood_risk_score: user.flood_risk_score,
          risk_score: user.risk_score,
          is_verified: user.is_verified
        },
        active_policy: activePolicy,
        claims_summary: {
          paid: parseInt(claimsSummary.paid_count),
          approved: parseInt(claimsSummary.approved_count),
          pending: parseInt(claimsSummary.pending_count),
          total_received: parseFloat(claimsSummary.total_received)
        },
        recent_claims: recentClaims.rows,
        weather: weather
          ? {
              rainfall_mm: parseFloat(weather.rainfall_mm),
              flood_alert: weather.flood_alert,
              recorded_at: weather.recorded_at
            }
          : null,
        total_premiums_paid: parseFloat(premiumResult.rows[0].total)
      }
    });
  } catch (err) {
    console.error('[DASHBOARD] Worker error:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
});

/**
 * GET /api/dashboard/admin
 * Admin overview dashboard
 */
router.get('/admin', adminMiddleware, async (req, res) => {
  try {
    // Platform stats
    const statsResult = await query(`
      SELECT
        COUNT(DISTINCT u.id) as total_riders,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') as active_policies,
        COUNT(DISTINCT u.id) FILTER (WHERE u.created_at > NOW() - INTERVAL '7 days') as new_this_week,
        COALESCE(SUM(ph.final_premium), 0) as total_premiums,
        COUNT(DISTINCT c.id) as total_claims,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'paid') as paid_claims,
        COALESCE(SUM(pay.amount) FILTER (WHERE pay.status = 'completed'), 0) as total_payouts,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'fraud_hold') as fraud_blocked,
        COALESCE(AVG(c.fraud_score), 0) as avg_fraud_score
      FROM users u
      LEFT JOIN policies p ON p.user_id = u.id
      LEFT JOIN premium_history ph ON ph.user_id = u.id
      LEFT JOIN claims c ON c.user_id = u.id
      LEFT JOIN payouts pay ON pay.user_id = u.id
      WHERE u.phone != '9999999999'
    `);
    const stats = statsResult.rows[0];

    // Zone-wise breakdown
    const zoneStats = await query(`
      SELECT
        z.name, z.flood_risk_score,
        COUNT(DISTINCT u.id) as riders,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') as active_policies,
        COUNT(DISTINCT c.id) as claims,
        COALESCE(SUM(c.claim_amount) FILTER (WHERE c.status = 'paid'), 0) as total_payouts,
        COALESCE((SELECT rainfall_mm FROM weather_data WHERE zone_id = z.id ORDER BY recorded_at DESC LIMIT 1), 0) as latest_rainfall,
        COALESCE((SELECT flood_alert FROM weather_data WHERE zone_id = z.id ORDER BY recorded_at DESC LIMIT 1), false) as flood_alert
      FROM zones z
      LEFT JOIN users u ON u.zone_id = z.id
      LEFT JOIN policies p ON p.zone_id = z.id
      LEFT JOIN claims c ON c.zone_id = z.id
      GROUP BY z.id
      ORDER BY z.flood_risk_score DESC
    `);

    // Recent claims (last 10)
    const recentClaims = await query(`
      SELECT c.*, u.full_name, u.phone, u.platform,
        z.name as zone_name, pay.payout_number
      FROM claims c
      JOIN users u ON u.id = c.user_id
      JOIN zones z ON z.id = c.zone_id
      LEFT JOIN payouts pay ON pay.claim_id = c.id
      ORDER BY c.created_at DESC LIMIT 10
    `);

    // Loss ratio
    const totalPremiums = parseFloat(stats.total_premiums) || 1;
    const totalPayouts = parseFloat(stats.total_payouts) || 0;
    const lossRatio = (totalPayouts / totalPremiums * 100).toFixed(2);

    res.json({
      success: true,
      dashboard: {
        overview: {
          total_riders: parseInt(stats.total_riders),
          active_policies: parseInt(stats.active_policies),
          new_this_week: parseInt(stats.new_this_week),
          total_premiums: parseFloat(stats.total_premiums),
          total_claims: parseInt(stats.total_claims),
          paid_claims: parseInt(stats.paid_claims),
          total_payouts: parseFloat(stats.total_payouts),
          fraud_blocked: parseInt(stats.fraud_blocked),
          loss_ratio: `${lossRatio}%`
        },
        zone_breakdown: zoneStats.rows,
        recent_claims: recentClaims.rows
      }
    });
  } catch (err) {
    console.error('[DASHBOARD] Admin error:', err);
    res.status(500).json({ success: false, message: 'Failed to load admin dashboard' });
  }
});

module.exports = router;
