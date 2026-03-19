/**
 * MonsoonShield AI - Parametric Trigger Engine
 * 
 * Triggers automatic claim generation when:
 *   1. Rainfall > 60mm in any 3-hour window
 *   2. Delivery volume drops > 40% vs baseline
 *   3. Both conditions = combined trigger (higher payout)
 */
const { query } = require('../config/db');
const weatherService = require('./weatherService');
const deliveryService = require('./deliveryService');
const fraudService = require('./fraudService');

const TRIGGER_THRESHOLDS = {
  RAINFALL_MM: 60,          // mm in 3 hours
  VOLUME_DROP_PCT: 40,      // % drop from baseline
  PAYOUT_RAINFALL: 0.75,    // 75% of coverage on rainfall trigger
  PAYOUT_VOLUME: 0.50,      // 50% of coverage on volume drop
  PAYOUT_COMBINED: 1.00,    // 100% of coverage on both triggers
};

class TriggerEngine {
  /**
   * Main trigger check - runs periodically via cron
   */
  async runTriggerCheck() {
    try {
      const zones = await query('SELECT * FROM zones WHERE is_active = true');

      for (const zone of zones.rows) {
        await this.checkZoneTriggers(zone);
      }
    } catch (err) {
      console.error('[TRIGGER] Run check failed:', err);
    }
  }

  /**
   * Check triggers for a specific zone
   */
  async checkZoneTriggers(zone) {
    const weatherData = await weatherService.getLatestWeather(zone.id);
    const volumeData = await deliveryService.getVolumeData(zone.id);

    const rainfallTriggered = weatherData.rainfall_mm >= TRIGGER_THRESHOLDS.RAINFALL_MM;
    const volumeTriggered = volumeData.drop_percentage >= TRIGGER_THRESHOLDS.VOLUME_DROP_PCT;

    if (!rainfallTriggered && !volumeTriggered) return;

    // Determine trigger type
    let triggerType, payoutRatio;
    if (rainfallTriggered && volumeTriggered) {
      triggerType = 'combined';
      payoutRatio = TRIGGER_THRESHOLDS.PAYOUT_COMBINED;
    } else if (rainfallTriggered) {
      triggerType = 'rainfall';
      payoutRatio = TRIGGER_THRESHOLDS.PAYOUT_RAINFALL;
    } else {
      triggerType = 'volume_drop';
      payoutRatio = TRIGGER_THRESHOLDS.PAYOUT_VOLUME;
    }

    console.log(`[TRIGGER] Zone ${zone.name}: ${triggerType} triggered! Rainfall: ${weatherData.rainfall_mm}mm, Volume drop: ${volumeData.drop_percentage}%`);

    // Find all active policies in this zone
    const activePolicies = await query(`
      SELECT p.*, u.upi_id, u.phone, u.full_name
      FROM policies p
      JOIN users u ON u.id = p.user_id
      WHERE p.zone_id = $1 
        AND p.status = 'active'
        AND p.end_date >= CURRENT_DATE
    `, [zone.id]);

    for (const policy of activePolicies.rows) {
      await this.generateAutoClaim(policy, zone, {
        triggerType,
        payoutRatio,
        weatherData,
        volumeData,
        rainfallTriggered,
        volumeTriggered
      });
    }
  }

  /**
   * Generate automatic claim for a policy
   */
  async generateAutoClaim(policy, zone, triggerContext) {
    try {
      const { triggerType, payoutRatio, weatherData, volumeData } = triggerContext;

      // Check if claim already exists for this trigger window (dedup)
      const existingClaim = await query(`
        SELECT id FROM claims
        WHERE policy_id = $1
          AND trigger_type = $2
          AND created_at > NOW() - INTERVAL '4 hours'
      `, [policy.id, triggerType]);

      if (existingClaim.rows.length > 0) {
        console.log(`[TRIGGER] Claim already exists for policy ${policy.policy_number}, skipping`);
        return;
      }

      const claimAmount = parseFloat(policy.coverage_amount) * payoutRatio;

      // Run fraud detection
      const fraudResult = await fraudService.checkClaim({
        user_id: policy.user_id,
        policy_id: policy.id,
        zone_id: zone.id,
        claim_amount: claimAmount,
        trigger_type: triggerType,
        rainfall_mm: weatherData.rainfall_mm
      });

      const claimNumber = `CLM-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000) + 100000}`;
      const claimStatus = fraudResult.fraud_score > 7.5 ? 'fraud_hold' :
                          fraudResult.fraud_score > 5.0 ? 'pending' : 'approved';

      // Insert claim
      const claimResult = await query(`
        INSERT INTO claims (
          claim_number, policy_id, user_id, zone_id,
          trigger_type, trigger_value, trigger_threshold,
          claim_amount, status, fraud_score, fraud_flags,
          weather_data_id, auto_generated
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, true)
        RETURNING *
      `, [
        claimNumber,
        policy.id,
        policy.user_id,
        zone.id,
        triggerType,
        triggerType === 'rainfall' ? weatherData.rainfall_mm : volumeData.drop_percentage,
        triggerType === 'rainfall' ? TRIGGER_THRESHOLDS.RAINFALL_MM : TRIGGER_THRESHOLDS.VOLUME_DROP_PCT,
        claimAmount,
        claimStatus,
        fraudResult.fraud_score,
        JSON.stringify(fraudResult.flags),
        weatherData.id
      ]);

      const claim = claimResult.rows[0];
      console.log(`[TRIGGER] Claim ${claimNumber} created: ${claimStatus} | Amount: ₹${claimAmount} | Fraud: ${fraudResult.fraud_score}`);

      // If auto-approved, trigger payout
      if (claimStatus === 'approved') {
        await this.triggerInstantPayout(claim, policy);
      }
    } catch (err) {
      console.error('[TRIGGER] generateAutoClaim error:', err);
    }
  }

  /**
   * Trigger instant payout simulation
   */
  async triggerInstantPayout(claim, policy) {
    try {
      const payoutNumber = `PAY-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000) + 100000}`;

      // Simulate Razorpay payout (mock)
      const razorpayResult = await this.simulateRazorpayPayout({
        upi_id: policy.upi_id,
        amount: claim.claim_amount,
        reference: claim.claim_number
      });

      await query(`
        INSERT INTO payouts (
          payout_number, claim_id, user_id, amount,
          payment_method, upi_id, razorpay_payout_id,
          razorpay_status, status, completed_at, is_simulated
        ) VALUES ($1,$2,$3,$4,'upi',$5,$6,$7,$8, NOW(), true)
      `, [
        payoutNumber,
        claim.id,
        claim.user_id,
        claim.claim_amount,
        policy.upi_id,
        razorpayResult.payout_id,
        razorpayResult.status,
        'completed'
      ]);

      // Update claim status
      await query("UPDATE claims SET status = 'paid', approved_at = NOW() WHERE id = $1", [claim.id]);
      console.log(`[PAYOUT] ₹${claim.claim_amount} sent to ${policy.upi_id} | ${payoutNumber}`);
    } catch (err) {
      console.error('[PAYOUT] triggerInstantPayout error:', err);
    }
  }

  /**
   * Simulate Razorpay Payout (mock for hackathon)
   */
  async simulateRazorpayPayout({ upi_id, amount, reference }) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      payout_id: `pout_mock_${Date.now()}`,
      status: 'processed',
      utr: `UTR${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      amount_paise: Math.round(amount * 100),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new TriggerEngine();
