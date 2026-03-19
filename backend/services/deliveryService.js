/**
 * Delivery Volume Service
 * Simulates Q-commerce order volume data (Zepto/Blinkit API mock)
 */
const { query } = require('../config/db');

// Baseline order volumes per zone per 3-hour window
const BASELINE_VOLUMES = {
  'Kurla':        180,
  'Dharavi':      120,
  'Sion':         150,
  'Andheri East': 220,
  'Bhandup':      130,
  'Vikhroli':     110,
  'Ghatkopar':    160,
  'Chembur':      140,
};

class DeliveryService {
  /**
   * Get current delivery volume for a zone
   */
  async getVolumeData(zoneId) {
    const result = await query(
      'SELECT * FROM delivery_volume_logs WHERE zone_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [zoneId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    return this.generateVolumeData(zoneId, false);
  }

  /**
   * Generate simulated delivery volume data
   */
  async generateVolumeData(zoneId, dropEvent = false) {
    const zoneResult = await query('SELECT name FROM zones WHERE id = $1', [zoneId]);
    const zoneName = zoneResult.rows[0]?.name || 'Unknown';
    const baseline = BASELINE_VOLUMES[zoneName] || 150;

    const dropPercent = dropEvent
      ? 40 + Math.random() * 40  // 40-80% drop
      : Math.random() * 20;       // 0-20% normal variation

    const currentVolume = Math.round(baseline * (1 - dropPercent / 100));

    const result = await query(`
      INSERT INTO delivery_volume_logs (zone_id, order_volume, baseline_volume, drop_percentage, is_anomaly)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [zoneId, currentVolume, baseline, Math.round(dropPercent * 10) / 10, dropPercent >= 40]);

    return result.rows[0];
  }

  /**
   * Simulate a delivery volume drop for demo
   */
  async simulateVolumeDrop(zoneId) {
    return this.generateVolumeData(zoneId, true);
  }

  /**
   * Get volume trend for last 24 hours
   */
  async getVolumeTrend(zoneId) {
    const result = await query(`
      SELECT 
        date_trunc('hour', recorded_at) as hour,
        AVG(order_volume) as avg_volume,
        AVG(drop_percentage) as avg_drop
      FROM delivery_volume_logs
      WHERE zone_id = $1 AND recorded_at > NOW() - INTERVAL '24 hours'
      GROUP BY hour
      ORDER BY hour
    `, [zoneId]);
    return result.rows;
  }
}

module.exports = new DeliveryService();
