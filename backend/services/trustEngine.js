

const { query } = require('../config/db');

const TRUST_LEVELS = {
  ELITE:    { min: 85, label: 'Elite',    emoji: '💎', discount: 0.20, color: '#7c3aed' },
  TRUSTED:  { min: 65, label: 'Trusted',  emoji: '🥇', discount: 0.12, color: '#059669' },
  GOOD:     { min: 45, label: 'Good',     emoji: '🥈', discount: 0.06, color: '#2563eb' },
  BUILDING: { min: 25, label: 'Building', emoji: '🥉', discount: 0.02, color: '#d97706' },
  NEW:      { min: 0,  label: 'New',      emoji: '🆕', discount: 0.00, color: '#6b7280' },
};

class TrustEngine {
  /**
   * Get trust level object from score
   */
  getTrustLevel(score) {
    for (const [key, level] of Object.entries(TRUST_LEVELS)) {
      if (score >= level.min) return { ...level, key };
    }
    return { ...TRUST_LEVELS.NEW, key: 'NEW' };
  }

  /**
   * Calculate premium discount based on trust score
   */
  getPremiumDiscount(trustScore) {
    const level = this.getTrustLevel(trustScore);
    return level.discount;
  }

  /**
   * Update trust score for a user
   */
  async updateScore(userId, change, reason) {
    try {
      const userResult = await query(
        'SELECT trust_score FROM users WHERE id = $1',
        [userId]
      );
      if (!userResult.rows[0]) return null;

      const oldScore = parseInt(userResult.rows[0].trust_score) || 50;
      const newScore = Math.min(100, Math.max(0, oldScore + change));
      const newLevel = this.getTrustLevel(newScore);

      await query(
        `UPDATE users SET 
          trust_score = $1, 
          trust_level = $2,
          trust_updated_at = NOW()
        WHERE id = $3`,
        [newScore, newLevel.label.toLowerCase(), userId]
      );

      // Log history
      await query(
        `INSERT INTO trust_history (user_id, old_score, new_score, change, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, oldScore, newScore, change, reason]
      );

      console.log(`[TRUST] User ${userId}: ${oldScore} → ${newScore} (${change > 0 ? '+' : ''}${change}) — ${reason}`);

      return { oldScore, newScore, change, reason, level: newLevel };
    } catch (err) {
      console.error('[TRUST] updateScore error:', err);
      return null;
    }
  }

  /**
   * Process weekly trust score updates (run via cron)
   */
  async processWeeklyUpdates() {
    try {
      console.log('[TRUST] Processing weekly trust updates...');

      // Find users with no claims this week → +5 points
      const claimFreeUsers = await query(`
        SELECT DISTINCT u.id
        FROM users u
        JOIN policies p ON p.user_id = u.id
        WHERE p.status = 'active'
          AND p.end_date >= CURRENT_DATE
          AND NOT EXISTS (
            SELECT 1 FROM claims c 
            WHERE c.user_id = u.id 
            AND c.created_at > NOW() - INTERVAL '7 days'
          )
      `);

      for (const user of claimFreeUsers.rows) {
        await this.updateScore(user.id, +5, 'claim_free_week');
        await query(
          'UPDATE users SET claim_free_weeks = claim_free_weeks + 1 WHERE id = $1',
          [user.id]
        );
      }

      // Find users whose policy auto-renewed → +10 points
      const renewedUsers = await query(`
        SELECT DISTINCT user_id FROM policies
        WHERE start_date = CURRENT_DATE AND auto_renew = true
      `);

      for (const user of renewedUsers.rows) {
        await this.updateScore(user.user_id, +10, 'policy_renewed');
      }

      console.log(`[TRUST] Updated ${claimFreeUsers.rows.length} claim-free users, ${renewedUsers.rows.length} renewed`);
    } catch (err) {
      console.error('[TRUST] Weekly update error:', err);
    }
  }

  /**
   * Penalize fraud attempts
   */
  async penalizeFraud(userId, fraudScore) {
    if (fraudScore >= 7.5) {
      await this.updateScore(userId, -25, 'claim_blocked_fraud');
    } else if (fraudScore >= 5.0) {
      await this.updateScore(userId, -15, 'fraud_flag_detected');
    } else if (fraudScore >= 3.0) {
      await this.updateScore(userId, -5, 'suspicious_activity');
    }
  }

  /**
   * Reward legitimate claim
   */
  async rewardLegitimateUse(userId) {
    await this.updateScore(userId, +2, 'legitimate_claim_approved');
  }

  /**
   * Get full trust profile for a user
   */
  async getTrustProfile(userId) {
    const userResult = await query(`
      SELECT 
        u.id, u.full_name, u.trust_score, u.trust_level,
        u.claim_free_weeks, u.total_income_recovered,
        u.total_income_lost, u.trust_updated_at,
        u.created_at as member_since,
        COUNT(DISTINCT p.id) as total_policies,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'paid') as paid_claims,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'fraud_hold') as fraud_flags,
        COALESCE(SUM(pay.amount) FILTER (WHERE pay.status = 'completed'), 0) as total_recovered,
        z.name as zone_name,
        z.flood_risk_score
      FROM users u
      LEFT JOIN policies p ON p.user_id = u.id
      LEFT JOIN claims c ON c.user_id = u.id
      LEFT JOIN payouts pay ON pay.user_id = u.id
      LEFT JOIN zones z ON z.id = u.zone_id
      WHERE u.id = $1
      GROUP BY u.id, z.name, z.flood_risk_score
    `, [userId]);

    const user = userResult.rows[0];
    if (!user) return null;

    const score = parseInt(user.trust_score) || 50;
    const level = this.getTrustLevel(score);
    const discount = this.getPremiumDiscount(score);

    // Trust history (last 10 events)
    const historyResult = await query(`
      SELECT * FROM trust_history 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [userId]);

    // Next milestone
    const nextLevel = this.getNextMilestone(score);

    // Income recovery stats
    const totalLost = parseFloat(user.total_income_lost) || 0;
    const totalRecovered = parseFloat(user.total_recovered) || 0;
    const recoveryRate = totalLost > 0 ? Math.round((totalRecovered / totalLost) * 100) : 0;

    return {
      score,
      level,
      discount_pct: Math.round(discount * 100),
      member_since: user.member_since,
      claim_free_weeks: parseInt(user.claim_free_weeks) || 0,
      total_policies: parseInt(user.total_policies) || 0,
      paid_claims: parseInt(user.paid_claims) || 0,
      fraud_flags: parseInt(user.fraud_flags) || 0,
      income_stats: {
        total_recovered: totalRecovered,
        total_lost: totalLost,
        recovery_rate: recoveryRate,
        net_benefit: totalRecovered - parseFloat(user.total_policies || 0) * 75
      },
      history: historyResult.rows,
      next_milestone: nextLevel,
      perks: this.getPerks(score)
    };
  }

  getNextMilestone(score) {
    const levels = Object.values(TRUST_LEVELS).sort((a, b) => a.min - b.min);
    for (const level of levels) {
      if (score < level.min) {
        return { level: level.label, points_needed: level.min - score, emoji: level.emoji };
      }
    }
    return null; // Already at max
  }

  getPerks(score) {
    const perks = [];
    if (score >= 25) perks.push('2% premium discount');
    if (score >= 45) perks.push('6% premium discount', 'Priority claim processing');
    if (score >= 65) perks.push('12% premium discount', 'Auto-approved claims', 'Extended coverage available');
    if (score >= 85) perks.push('20% premium discount', 'Instant payouts', 'VIP support', 'Higher coverage limits');
    return perks;
  }
}

module.exports = new TrustEngine();
