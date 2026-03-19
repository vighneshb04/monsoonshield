/**
 * Seed script - inserts demo data for hackathon presentation
 * Run with: node config/seed.js
 */
require('dotenv').config();
const { pool } = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Seeding MonsoonShield database...');

  // Demo admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  await pool.query(`
    INSERT INTO users (full_name, phone, email, password_hash, platform, is_verified, is_active)
    VALUES ('Admin User', '9999999999', 'admin@monsoonshield.in', $1, 'admin', true, true)
    ON CONFLICT (phone) DO NOTHING
  `, [adminHash]);

  // Demo rider - Raju
  const zones = await pool.query('SELECT id, name FROM zones LIMIT 4');
  const zoneMap = {};
  zones.rows.forEach(z => zoneMap[z.name] = z.id);

  const riderHash = await bcrypt.hash('rider123', 10);
  const riderResult = await pool.query(`
    INSERT INTO users (full_name, phone, email, password_hash, platform, zone_id, is_verified, upi_id, risk_score)
    VALUES 
      ('Raju Sharma', '9876543210', 'raju@example.com', $1, 'blinkit', $2, true, 'raju@upi', 4.2),
      ('Vijay Kumar', '9876543211', 'vijay@example.com', $1, 'zepto',   $3, true, 'vijay@upi', 5.5),
      ('Suresh Patil', '9876543212', 'suresh@example.com',$1, 'blinkit', $4, true, 'suresh@upi', 3.8)
    ON CONFLICT (phone) DO NOTHING
    RETURNING id, full_name
  `, [riderHash, zoneMap['Kurla'], zoneMap['Dharavi'], zoneMap['Sion']]);

  console.log('✅ Users seeded');

  // Seed demo policy for Raju
  if (riderResult.rows.length > 0) {
    const rajuId = riderResult.rows[0].id;
    await pool.query(`
      INSERT INTO policies (user_id, zone_id, policy_number, coverage_amount, weekly_premium, start_date, end_date)
      VALUES ($1, $2, 'MSH-2024-000001', 2000.00, 85.00, CURRENT_DATE, CURRENT_DATE + 7)
      ON CONFLICT (policy_number) DO NOTHING
    `, [rajuId, zoneMap['Kurla']]);
  }

  // Seed demo weather events (including a flood trigger)
  for (const zone of zones.rows) {
    await pool.query(`
      INSERT INTO weather_data (zone_id, rainfall_mm, rainfall_1h, rainfall_24h, flood_alert, data_source)
      VALUES ($1, $2, $3, $4, $5, 'seed')
    `, [
      zone.id,
      Math.random() > 0.5 ? 75 : 15,  // random flood or normal
      Math.random() * 30,
      Math.random() * 100,
      Math.random() > 0.5
    ]);
  }

  console.log('✅ Weather data seeded');
  console.log('🎉 Seeding complete!');
  console.log('\nDemo Credentials:');
  console.log('  Rider: phone=9876543210, password=rider123');
  console.log('  Admin: phone=9999999999, password=admin123');
  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
