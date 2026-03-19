/**
 * Fraud Detection Service
 * Calls ML microservice for Isolation Forest analysis
 * Plus rule-based checks for GPS, duplicates, velocity
 */
const axios = require('axios');
const { query } = require('../config/db');

class FraudService {
  /**
   * Main fraud check for a claim
   */
  async checkClaim(claimData) {
    const { user_id, policy_id, zone_id, claim_amount, trigger_type, rainfall_mm } = claimData;

    const flags = [];
    let maxScore = 0;

    // ── Rule 1: Duplicate claim check ─────────────────────────────
    const duplicateScore = await this.checkDuplicateClaim(user_id, trigger_type);
    if (duplicateScore > 0) {
      flags.push({ type: 'duplicate_claim', score: duplicateScore, detail: 'Recent similar claim detected' });
      maxScore = Math.max(maxScore, duplicateScore);
    }

    // ── Rule 2: Claim velocity check ──────────────────────────────
    const velocityScore = await this.checkClaimVelocity(user_id);
    if (velocityScore > 0) {
      flags.push({ type: 'high_velocity', score: velocityScore, detail: 'Multiple claims in short period' });
      maxScore = Math.max(maxScore, velocityScore);
    }

    // ── Rule 3: Zone consistency check ────────────────────────────
    const zoneScore = await this.checkZoneConsistency(user_id, zone_id);
    if (zoneScore > 0) {
      flags.push({ type: 'zone_mismatch', score: zoneScore, detail: 'User zone inconsistency' });
      maxScore = Math.max(maxScore, zoneScore);
    }

    // ── Rule 4: ML Isolation Forest ───────────────────────────────
    let mlScore = 0;
    try {
      const userHistory = await this.getUserClaimHistory(user_id);
      const mlResult = await axios.post(`${process.env.ML_SERVICE_URL}/fraud-detect`, {
        features: {
          claim_amount,
          rainfall_mm: rainfall_mm || 0,
          claims_last_30d: userHistory.count,
          avg_claim_amount: userHistory.avg_amount,
          days_since_policy_start: userHistory.days_active,
          trigger_type_encoded: trigger_type === 'combined' ? 2 : trigger_type === 'rainfall' ? 1 : 0
        }
      }, { timeout: 3000 });

      mlScore = mlResult.data.fraud_score || 0;
      if (mlScore > 3.0) {
        flags.push({ type: 'isolation_forest', score: mlScore, detail: 'Anomaly detected by ML model' });
        maxScore = Math.max(maxScore, mlScore);
      }
    } catch (err) {
      console.warn('[FRAUD] ML service unavailable, using rule-based only');
    }

    const finalScore = Math.min(maxScore, 10);

    // Log fraud check
    await query(`
      INSERT INTO fraud_logs (user_id, check_type, risk_score, flags, action_taken, raw_features)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      user_id,
      flags.length > 0 ? flags[0].type : 'clean',
      finalScore,
      JSON.stringify(flags),
      finalScore > 7.5 ? 'blocked' : finalScore > 5.0 ? 'flagged' : 'approved',
      JSON.stringify(claimData)
    ]);

    return {
      fraud_score: finalScore,
      flags,
      action: finalScore > 7.5 ? 'blocked' : finalScore > 5.0 ? 'flagged' : 'approved',
      ml_powered: mlScore > 0
    };
  }

  async checkDuplicateClaim(userId, triggerType) {
    const result = await query(`
      SELECT COUNT(*) as count FROM claims
      WHERE user_id = $1 AND trigger_type = $2 AND created_at > NOW() - INTERVAL '6 hours'
    `, [userId, triggerType]);
    const count = parseInt(result.rows[0].count);
    return count > 0 ? Math.min(count * 4, 8) : 0;
  }

  async checkClaimVelocity(userId) {
    const result = await query(`
      SELECT COUNT(*) as count FROM claims
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
    `, [userId]);
    const count = parseInt(result.rows[0].count);
    if (count > 5) return 7.0;
    if (count > 3) return 5.0;
    if (count > 1) return 2.0;
    return 0;
  }

  async checkZoneConsistency(userId, claimZoneId) {
    const userResult = await query('SELECT zone_id FROM users WHERE id = $1', [userId]);
    const userZone = userResult.rows[0]?.zone_id;
    if (userZone && userZone !== claimZoneId) return 3.0;
    return 0;
  }

  async getUserClaimHistory(userId) {
    const result = await query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(AVG(claim_amount), 0) as avg_amount,
        COALESCE(EXTRACT(DAYS FROM NOW() - MIN(p.start_date)), 0) as days_active
      FROM claims c
      JOIN policies p ON p.id = c.policy_id
      WHERE c.user_id = $1 AND c.created_at > NOW() - INTERVAL '30 days'
    `, [userId]);

    return {
      count: parseInt(result.rows[0].count),
      avg_amount: parseFloat(result.rows[0].avg_amount),
      days_active: parseFloat(result.rows[0].days_active)
    };
  }
}

module.exports = new FraudService();
