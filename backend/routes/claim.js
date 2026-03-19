const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { query } = require('../config/db');

/**
 * POST /api/claim/auto
 * Manually trigger auto-claim generation (admin/demo)
 */
router.post('/auto', adminMiddleware, async (req, res) => {
  try {
    const TriggerEngine = require('../services/triggerEngine');
    await TriggerEngine.runTriggerCheck();
    res.json({ success: true, message: 'Auto-claim check triggered for all zones' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Auto-claim failed' });
  }
});

/**
 * GET /api/claim/my
 * Get claims for logged-in rider
 */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, z.name as zone_name,
        p.policy_number, p.coverage_amount,
        pay.status as payout_status, pay.payout_number,
        pay.completed_at as paid_at
      FROM claims c
      JOIN zones z ON z.id = c.zone_id
      JOIN policies p ON p.id = c.policy_id
      LEFT JOIN payouts pay ON pay.claim_id = c.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
    `, [req.user.id]);

    res.json({ success: true, claims: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
});

/**
 * GET /api/claim/all - Admin: all claims
 */
router.get('/all', adminMiddleware, async (req, res) => {
  try {
    const { status, zone_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) { params.push(status); whereClause += ` AND c.status = $${params.length}`; }
    if (zone_id) { params.push(zone_id); whereClause += ` AND c.zone_id = $${params.length}`; }

    params.push(limit, offset);
    const result = await query(`
      SELECT c.*, u.full_name, u.phone, u.platform,
        z.name as zone_name, p.policy_number,
        pay.payout_number, pay.status as payout_status
      FROM claims c
      JOIN users u ON u.id = c.user_id
      JOIN zones z ON z.id = c.zone_id
      JOIN policies p ON p.id = c.policy_id
      LEFT JOIN payouts pay ON pay.claim_id = c.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countResult = await query(`SELECT COUNT(*) FROM claims c ${whereClause}`, params.slice(0, -2));

    res.json({
      success: true,
      claims: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
});

/**
 * PATCH /api/claim/:id/status - Admin: update claim status
 */
router.patch('/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { status, rejected_reason } = req.body;
    const validStatuses = ['approved', 'rejected', 'fraud_hold', 'pending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await query(`
      UPDATE claims SET status = $1, rejected_reason = $2, updated_at = NOW()
      WHERE id = $3 RETURNING *
    `, [status, rejected_reason || null, req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Claim not found' });

    // If approved, trigger payout
    if (status === 'approved') {
      const claim = result.rows[0];
      const policyResult = await query('SELECT * FROM policies WHERE id = $1', [claim.policy_id]);
      if (policyResult.rows[0]) {
        const TriggerEngine = require('../services/triggerEngine');
        await TriggerEngine.triggerInstantPayout(claim, policyResult.rows[0]);
      }
    }

    res.json({ success: true, claim: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Status update failed' });
  }
});

module.exports = router;
