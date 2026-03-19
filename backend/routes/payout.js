const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { query } = require('../config/db');

/**
 * POST /api/payout/process
 * Process payout for an approved claim
 */
router.post('/process', adminMiddleware, async (req, res) => {
  try {
    const { claim_id } = req.body;
    if (!claim_id) return res.status(400).json({ success: false, message: 'claim_id required' });

    const claimResult = await query(
      "SELECT c.*, p.upi_id FROM claims c JOIN policies p ON p.id = c.policy_id WHERE c.id = $1 AND c.status = 'approved'",
      [claim_id]
    );

    if (!claimResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Approved claim not found' });
    }

    const claim = claimResult.rows[0];

    // Check if payout already exists
    const existing = await query("SELECT id FROM payouts WHERE claim_id = $1", [claim_id]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Payout already processed' });
    }

    // Simulate Razorpay payout
    const payoutNumber = `PAY-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000) + 100000}`;
    const razorpayId = `pout_mock_${Date.now()}`;

    const payoutResult = await query(`
      INSERT INTO payouts (payout_number, claim_id, user_id, amount, payment_method, upi_id, razorpay_payout_id, razorpay_status, status, completed_at, is_simulated)
      VALUES ($1, $2, $3, $4, 'upi', $5, $6, 'processed', 'completed', NOW(), true)
      RETURNING *
    `, [payoutNumber, claim_id, claim.user_id, claim.claim_amount, claim.upi_id, razorpayId]);

    // Update claim
    await query("UPDATE claims SET status = 'paid', approved_at = NOW() WHERE id = $1", [claim_id]);

    res.json({
      success: true,
      message: `₹${claim.claim_amount} payout initiated`,
      payout: payoutResult.rows[0],
      razorpay_simulation: {
        payout_id: razorpayId,
        utr: `UTR${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        status: 'processed',
        mode: 'UPI',
        note: 'This is a test mode simulation'
      }
    });
  } catch (err) {
    console.error('[PAYOUT] Process error:', err);
    res.status(500).json({ success: false, message: 'Payout processing failed' });
  }
});

/**
 * GET /api/payout/my
 */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT pay.*, c.claim_number, c.trigger_type, z.name as zone_name
      FROM payouts pay
      JOIN claims c ON c.id = pay.claim_id
      JOIN zones z ON z.id = c.zone_id
      WHERE pay.user_id = $1
      ORDER BY pay.created_at DESC
    `, [req.user.id]);

    res.json({ success: true, payouts: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch payouts' });
  }
});

module.exports = router;
