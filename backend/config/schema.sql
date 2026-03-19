-- ============================================================
-- MonsoonShield AI - Complete Database Schema
-- PostgreSQL
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Zones ────────────────────────────────────────────────────────────────────
CREATE TABLE zones (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL UNIQUE,           -- e.g., 'Kurla', 'Dharavi'
  city          VARCHAR(100) NOT NULL DEFAULT 'Mumbai',
  flood_risk_score DECIMAL(4,2) NOT NULL,               -- 0.00 - 10.00
  zone_multiplier  DECIMAL(4,3) NOT NULL DEFAULT 1.0,   -- premium multiplier
  latitude      DECIMAL(9,6),
  longitude     DECIMAL(9,6),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Users (Riders) ───────────────────────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name       VARCHAR(200) NOT NULL,
  phone           VARCHAR(15) NOT NULL UNIQUE,
  email           VARCHAR(255) UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  platform        VARCHAR(50) NOT NULL,                 -- 'zepto' | 'blinkit' | 'swiggy'
  zone_id         UUID REFERENCES zones(id),
  aadhaar_last4   VARCHAR(4),                           -- last 4 digits only
  bank_account    VARCHAR(20),                          -- encrypted in prod
  ifsc_code       VARCHAR(11),
  upi_id          VARCHAR(100),
  is_active       BOOLEAN DEFAULT true,
  is_verified     BOOLEAN DEFAULT false,
  risk_score      DECIMAL(4,2) DEFAULT 5.0,             -- computed risk 0-10
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Policies ─────────────────────────────────────────────────────────────────
CREATE TABLE policies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  zone_id         UUID NOT NULL REFERENCES zones(id),
  policy_number   VARCHAR(30) NOT NULL UNIQUE,          -- MSH-2024-XXXXXX
  status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active|expired|cancelled|suspended
  coverage_amount DECIMAL(10,2) NOT NULL,               -- weekly income coverage
  weekly_premium  DECIMAL(8,2) NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,                        -- 7 days from start
  auto_renew      BOOLEAN DEFAULT true,
  total_paid      DECIMAL(10,2) DEFAULT 0,
  claims_count    INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Premium History ──────────────────────────────────────────────────────────
CREATE TABLE premium_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id       UUID NOT NULL REFERENCES policies(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  week_start      DATE NOT NULL,
  week_end        DATE NOT NULL,
  base_rate       DECIMAL(8,2) NOT NULL,
  flood_risk_score DECIMAL(4,2) NOT NULL,
  zone_multiplier  DECIMAL(4,3) NOT NULL,
  safety_discount  DECIMAL(8,2) DEFAULT 0,
  final_premium   DECIMAL(8,2) NOT NULL,
  payment_status  VARCHAR(20) DEFAULT 'pending',        -- pending|paid|failed
  payment_id      VARCHAR(100),                         -- Razorpay payment ID
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Weather Data ─────────────────────────────────────────────────────────────
CREATE TABLE weather_data (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id         UUID NOT NULL REFERENCES zones(id),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rainfall_mm     DECIMAL(6,2) NOT NULL DEFAULT 0,      -- mm in last 3 hours
  rainfall_1h     DECIMAL(6,2) DEFAULT 0,               -- mm last 1 hour
  rainfall_24h    DECIMAL(6,2) DEFAULT 0,               -- mm last 24 hours
  wind_speed      DECIMAL(5,2) DEFAULT 0,               -- km/h
  humidity        DECIMAL(5,2) DEFAULT 0,               -- percentage
  visibility      DECIMAL(6,2) DEFAULT 10,              -- km
  flood_alert     BOOLEAN DEFAULT false,
  data_source     VARCHAR(50) DEFAULT 'openweather',    -- openweather|mock|imd
  raw_data        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Claims ───────────────────────────────────────────────────────────────────
CREATE TABLE claims (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_number    VARCHAR(30) NOT NULL UNIQUE,          -- CLM-2024-XXXXXX
  policy_id       UUID NOT NULL REFERENCES policies(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  zone_id         UUID NOT NULL REFERENCES zones(id),
  trigger_type    VARCHAR(50) NOT NULL,                 -- 'rainfall'|'volume_drop'|'combined'
  trigger_value   DECIMAL(8,2),                         -- rainfall mm or drop %
  trigger_threshold DECIMAL(8,2),                      -- threshold that was crossed
  claim_amount    DECIMAL(10,2) NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending',        -- pending|approved|rejected|paid|fraud_hold
  fraud_score     DECIMAL(4,2) DEFAULT 0,               -- 0-10, higher = more suspicious
  fraud_flags     JSONB DEFAULT '[]',                   -- list of fraud flags
  weather_data_id UUID REFERENCES weather_data(id),
  auto_generated  BOOLEAN DEFAULT true,
  approved_at     TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Fraud Logs ───────────────────────────────────────────────────────────────
CREATE TABLE fraud_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id        UUID REFERENCES claims(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  check_type      VARCHAR(50) NOT NULL,                 -- 'isolation_forest'|'gps'|'duplicate'|'velocity'
  risk_score      DECIMAL(4,2) NOT NULL,               -- 0-10
  flags           JSONB DEFAULT '[]',
  gps_lat         DECIMAL(9,6),
  gps_lng         DECIMAL(9,6),
  gps_zone_match  BOOLEAN,
  raw_features    JSONB,                               -- ML input features
  model_output    JSONB,                               -- ML model output
  action_taken    VARCHAR(50),                          -- 'approved'|'flagged'|'blocked'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Payouts ──────────────────────────────────────────────────────────────────
CREATE TABLE payouts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_number   VARCHAR(30) NOT NULL UNIQUE,          -- PAY-2024-XXXXXX
  claim_id        UUID NOT NULL REFERENCES claims(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  amount          DECIMAL(10,2) NOT NULL,
  payment_method  VARCHAR(30) DEFAULT 'upi',           -- upi|bank_transfer
  upi_id          VARCHAR(100),
  bank_account    VARCHAR(20),
  razorpay_payout_id VARCHAR(100),
  razorpay_status VARCHAR(50),
  status          VARCHAR(20) DEFAULT 'pending',       -- pending|processing|completed|failed
  initiated_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  failure_reason  TEXT,
  is_simulated    BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Admin Metrics (Daily Snapshot) ───────────────────────────────────────────
CREATE TABLE admin_metrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date            DATE NOT NULL UNIQUE,
  total_riders    INT DEFAULT 0,
  active_policies INT DEFAULT 0,
  new_registrations INT DEFAULT 0,
  premiums_collected DECIMAL(12,2) DEFAULT 0,
  claims_triggered INT DEFAULT 0,
  claims_paid     INT DEFAULT 0,
  payouts_total   DECIMAL(12,2) DEFAULT 0,
  fraud_blocked   INT DEFAULT 0,
  avg_rainfall_mm DECIMAL(6,2) DEFAULT 0,
  zones_affected  INT DEFAULT 0,
  loss_ratio      DECIMAL(6,4) DEFAULT 0,              -- payouts/premiums
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Delivery Volume Logs (Simulated) ─────────────────────────────────────────
CREATE TABLE delivery_volume_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id         UUID NOT NULL REFERENCES zones(id),
  recorded_at     TIMESTAMPTZ DEFAULT NOW(),
  order_volume    INT NOT NULL,                        -- orders in last 3h window
  baseline_volume INT NOT NULL,                        -- expected baseline
  drop_percentage DECIMAL(5,2) DEFAULT 0,              -- how much it dropped
  is_anomaly      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_users_zone_id        ON users(zone_id);
CREATE INDEX idx_users_phone          ON users(phone);
CREATE INDEX idx_policies_user_id     ON policies(user_id);
CREATE INDEX idx_policies_status      ON policies(status);
CREATE INDEX idx_weather_zone_time    ON weather_data(zone_id, recorded_at DESC);
CREATE INDEX idx_claims_user_id       ON claims(user_id);
CREATE INDEX idx_claims_status        ON claims(status);
CREATE INDEX idx_payouts_claim_id     ON payouts(claim_id);
CREATE INDEX idx_fraud_logs_user_id   ON fraud_logs(user_id);
CREATE INDEX idx_delivery_zone_time   ON delivery_volume_logs(zone_id, recorded_at DESC);

-- ─── Seed Zones ───────────────────────────────────────────────────────────────
INSERT INTO zones (name, city, flood_risk_score, zone_multiplier, latitude, longitude) VALUES
  ('Kurla',        'Mumbai', 8.5, 1.85, 19.0728, 72.8826),
  ('Dharavi',      'Mumbai', 8.2, 1.80, 19.0400, 72.8543),
  ('Sion',         'Mumbai', 7.8, 1.70, 19.0434, 72.8614),
  ('Andheri East', 'Mumbai', 7.2, 1.60, 19.1136, 72.8697),
  ('Bhandup',      'Mumbai', 7.5, 1.65, 19.1474, 72.9393),
  ('Vikhroli',     'Mumbai', 7.0, 1.55, 19.1059, 72.9312),
  ('Ghatkopar',    'Mumbai', 6.8, 1.50, 19.0860, 72.9081),
  ('Chembur',      'Mumbai', 6.5, 1.45, 19.0620, 72.8990);
