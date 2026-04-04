# 🌧️ MonsoonShield AI
### Hyperlocal Parametric Income Protection for Mumbai's Q-Commerce Riders
### Guidewire DEVTrails 2026 — Phase 2 Submission

<div align="center">

![MonsoonShield AI](https://img.shields.io/badge/MonsoonShield-AI%20Powered-blue?style=for-the-badge&logo=cloud&logoColor=white)
![Phase](https://img.shields.io/badge/Phase-2%20%7C%20Scale%20%26%20Protect-gold?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Live%20%F0%9F%9F%A2-green?style=for-the-badge)

**🌐 Live Demo:** [monsoonshield.vercel.app](https://monsoonshield.vercel.app)  
**🔌 API:** [monsoonshield-api.onrender.com](https://monsoonshield-api.onrender.com/health)  
**🤖 ML Docs:** [monsoonshield-ml.onrender.com/docs](https://monsoonshield-ml.onrender.com/docs)

</div>

---

## 🎯 The Problem

Mumbai's 200,000+ Q-commerce delivery riders (Zepto, Blinkit) lose **20-30% of weekly income** every monsoon season. When Kurla floods, they can't deliver. When they can't deliver, they don't earn. Traditional insurance takes weeks. They need protection **in minutes**.

---

## ⚡ What's New in Phase 2

### 🆕 Coverage on Demand — Hourly Micro-Insurance
> **The most novel feature in this hackathon.**

No other team built this. Instead of weekly-only policies, riders can now activate **storm coverage for exactly 1, 3, or 6 hours** — right when they see dark clouds.

- ₹8 for 1-hour coverage → ₹200 payout if flood triggers
- ₹21 for 3-hour coverage → ₹600 payout if flood triggers  
- ₹38 for 6-hour coverage → ₹1200 payout if flood triggers
- **Dynamic pricing** — surcharge applied when rain already detected
- **Live countdown timer** showing coverage expiry
- **Auto-trigger** — if 60mm rain hits during window → instant payout

```
Rider sees dark clouds at 2pm
         ↓
Taps "3-Hour Coverage" → pays ₹21
         ↓
At 3pm: 75mm rain detected in Kurla
         ↓
Claim auto-generated → fraud check → UPI payout ₹600
         ↓
Total time from trigger to payout: < 30 seconds
```

### ✅ Phase 1 Features (Enhanced)
- AI-powered weekly premium (Gradient Boosting ML)
- Parametric trigger engine (rainfall + volume drop)
- 4-layer fraud detection (Isolation Forest)
- Instant UPI payout simulation
- Rider + Admin dashboards
- Zone risk map with live rainfall

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RIDER'S PHONE                            │
│              monsoonshield.vercel.app                       │
│         Next.js 14 · Tailwind CSS · Mobile-First           │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS REST API
┌─────────────────────▼───────────────────────────────────────┐
│              BACKEND (Node.js + Express)                    │
│         monsoonshield-api.onrender.com                      │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Auth    │ │ Policy   │ │ Claims   │ │   DEMAND     │  │
│  │  JWT     │ │ Weekly   │ │ Auto-Gen │ │   COVERAGE   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         PARAMETRIC TRIGGER ENGINE (Cron/30min)      │   │
│  │  Weather API → Volume API → Fraud Check → Payout    │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────┬────────────────────────┬────────────────────────┘
           │                        │
┌──────────▼──────────┐  ┌─────────▼──────────────────────┐
│   ML SERVICE        │  │      DATABASE (Neon PostgreSQL)  │
│   FastAPI + Python  │  │                                  │
│                     │  │  users · zones · policies        │
│  GradientBoosting   │  │  claims · payouts · fraud_logs   │
│  (Premium Model)    │  │  demand_coverage · weather_data  │
│                     │  │  delivery_volume_logs            │
│  IsolationForest    │  │                                  │
│  (Fraud Detection)  │  └──────────────────────────────────┘
└─────────────────────┘
```

---

## 💰 Premium Models

### Weekly Premium Formula
```
Premium = BaseRate + (FloodRiskScore × ZoneMultiplier) - SafetyDiscount

BaseRate        = CoverageAmount × 3%
FloodRiskScore  = 0-10 (historical + live weather data)
ZoneMultiplier  = 1.45x–1.85x (zone waterlogging history)
SafetyDiscount  = 20% of BaseRate for claim-free riders

Example — Kurla rider, ₹2000 coverage:
  BaseRate     = ₹60.00
  Risk Factor  = 8.5 × 1.85 × 0.9 = ₹14.14
  Discount     = ₹12.00 (no past claims)
  WEEKLY TOTAL = ₹62.14
```

### On-Demand Hourly Formula
```
HourlyPremium = ₹4 × ZoneMultiplier × WeatherSurcharge × Hours × Discount

WeatherSurcharge = 1.5x if rainfall > 30mm (storm imminent)
                 = 1.2x if rainfall > 15mm (rain present)  
                 = 1.0x if dry (standard rate)

Discount = 1.0x for 1hr | 0.9x for 3hr | 0.8x for 6hr
```

---

## ⚡ Parametric Trigger Engine

```
Every 30 minutes (automated cron job):

Zone Loop
    │
    ├── Fetch rainfall_mm from OpenWeatherMap API
    ├── Fetch delivery_volume from simulated Q-commerce API
    │
    ├── rainfall_mm ≥ 60?  ────────── Rainfall Trigger (75% payout)
    ├── volume_drop ≥ 40%? ────────── Volume Trigger  (50% payout)  
    └── BOTH triggered?    ────────── Combined Trigger (100% payout)
                │
                ▼
        For each active policy in zone:
                │
                ▼
        FraudService.checkClaim()
          ├── Isolation Forest ML    → anomaly_score
          ├── Duplicate detection    → 6hr window check
          ├── Velocity check         → 7-day claim count
          └── Zone consistency       → registered vs claim zone
                │
                ▼
        fraud_score > 7.5 → BLOCKED (fraud_hold)
        fraud_score > 5.0 → FLAGGED (manual review)
        fraud_score < 5.0 → APPROVED → Instant UPI Payout
```

---

## 🤖 ML Models

### Model 1: Premium Regression (GradientBoostingRegressor)
| Feature | Description |
|---------|-------------|
| `flood_risk_score` | Zone's historical flood frequency (0-10) |
| `zone_multiplier` | Pricing factor for zone (1.45-1.85) |
| `coverage_amount` | Rider's chosen weekly coverage (₹) |
| `rider_risk_score` | Individual risk score from behavior |
| `rainfall_mm` | Current 3-hour rainfall reading |
| `past_claims` | Number of claims in last 90 days |

- **Training data:** 2000 synthetic samples (Mumbai actuarial domain knowledge)
- **MAE:** ~₹3.2 | **R²:** 0.94

### Model 2: Fraud Detection (Isolation Forest)
| Feature | Fraud Signal |
|---------|-------------|
| `claim_amount` | Always claiming maximum = suspicious |
| `rainfall_mm` | Low rain + rainfall claim = red flag |
| `claims_last_30d` | High frequency = velocity fraud |
| `days_since_policy` | Claim on day 1 = likely fraud |
| `avg_claim_amount` | Sudden spike vs historical = anomaly |

- **Contamination:** 8% (expected fraud rate)
- **Detection rate:** 100% on training data
- **Fraud score:** 0-10 (higher = more suspicious)

---

## 🛡️ 4-Layer Fraud Detection

```
Claim Received
      │
      ▼
Layer 1: Isolation Forest ML
  → Anomaly score vs 3000 claim patterns
  → Flags if claim behavior is statistically unusual
      │
      ▼
Layer 2: Duplicate Detection
  → Has same user claimed same trigger in last 6 hours?
  → Score += 4.0 per duplicate found
      │
      ▼
Layer 3: Velocity Check
  → More than 3 claims in 7 days? → Score += 5.0
  → More than 5 claims? → Score += 7.0
      │
      ▼
Layer 4: Zone Consistency
  → Is claim zone = registered zone?
  → Mismatch → Score += 3.0
      │
      ▼
Final Score:
  < 5.0  → ✅ Auto-approved + instant payout
  5-7.5  → ⚠️  Flagged for manual review
  > 7.5  → 🚫 Blocked (fraud_hold)
```

---

## 📱 App Pages

| Page | URL | Who | Description |
|------|-----|-----|-------------|
| Login | `/login` | All | Demo credentials below |
| Register | `/register` | Rider | 2-step onboarding |
| Dashboard | `/dashboard` | Rider | Policy, weather, claims |
| Policy | `/policy` | Rider | Buy weekly coverage |
| **Storm Cover** | `/demand` | Rider | **NEW: Hourly on-demand** |
| Claims | `/claims` | Rider | Claims + payout history |
| Zones | `/zones` | Rider | Live zone risk map |
| Admin | `/admin` | Admin | Platform metrics |
| Claims Mgmt | `/admin/claims` | Admin | Approve/reject/pay |
| **Simulate** | `/admin/simulate` | Admin | **Live flood demo** |

---

## 🔑 Demo Credentials

| Role | Phone | Password |
|------|-------|----------|
| 🛵 Rider (Kurla) | `9876543210` | `rider123` |
| 🛡️ Admin | `9999999999` | `admin123` |

---

## 🎮 Demo Flow for Judges

### Flow 1: Weekly Policy (2 min)
1. Login as Rider → see dashboard with zone risk
2. Go to Policy → move coverage slider → watch AI recalculate premium live
3. Activate policy → confirmation

### Flow 2: Coverage on Demand (2 min) ⭐ NEW
1. Go to Storm Cover page
2. See live storm risk level + current rainfall
3. Choose 3-hour package → tap Activate
4. See countdown timer running live
5. Go to History tab → see coverage logged

### Flow 3: Flood Simulation + Auto Payout (3 min)
1. Login as Admin → go to Simulate
2. Select Kurla zone → click Simulate Flood
3. Watch live log: 85mm injected → volume drop → claims generated → fraud checked → payouts sent
4. Go to Claims → see auto-generated claims with fraud scores
5. Login as Rider → see payout received on dashboard

---

## 🌐 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new rider |
| POST | `/api/auth/login` | Login |
| GET | `/api/zones` | All zones with live rainfall |
| GET | `/api/premium/calculate` | AI premium calculation |
| POST | `/api/policy/create` | Create weekly policy |
| **GET** | **`/api/demand/pricing`** | **On-demand pricing** |
| **POST** | **`/api/demand/activate`** | **Activate hourly coverage** |
| **GET** | **`/api/demand/my`** | **Coverage history** |
| GET | `/api/claim/my` | Rider's claims |
| POST | `/api/payout/process` | Process payout |
| GET | `/api/dashboard/worker` | Rider dashboard data |
| GET | `/api/dashboard/admin` | Admin metrics |
| POST | `/api/trigger/simulate-flood` | Demo flood trigger |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | Node.js, Express.js, JWT Auth |
| ML Service | Python, FastAPI, Scikit-learn |
| ML Models | GradientBoostingRegressor, IsolationForest |
| Database | PostgreSQL (Neon) |
| Deployment | Vercel (frontend), Render (backend + ML) |
| Weather | OpenWeatherMap API (mock fallback) |
| Payments | Razorpay Test Mode (simulated) |
| Scheduling | node-cron (30-min trigger checks) |

---

## 📁 Project Structure

```
monsoonshield/
├── backend/
│   ├── config/
│   │   ├── db.js              # PostgreSQL pool
│   │   ├── schema.sql         # Complete DB schema
│   │   └── seed.js            # Demo data seeder
│   ├── middleware/auth.js     # JWT middleware
│   ├── routes/
│   │   ├── auth.js            # Register/Login
│   │   ├── zones.js           # Zone data + live weather
│   │   ├── premium.js         # AI premium calculation
│   │   ├── policy.js          # Weekly policy CRUD
│   │   ├── demand.js          # ⭐ On-demand hourly coverage
│   │   ├── trigger.js         # Parametric triggers + simulation
│   │   ├── claim.js           # Claims management
│   │   ├── payout.js          # Payout processing
│   │   ├── dashboard.js       # Dashboard APIs
│   │   └── weather.js         # Weather data
│   ├── services/
│   │   ├── triggerEngine.js   # Core parametric engine
│   │   ├── weatherService.js  # OpenWeather + mock
│   │   ├── deliveryService.js # Order volume simulation
│   │   └── fraudService.js    # 4-layer fraud detection
│   └── server.js
│
├── frontend/
│   ├── components/dashboard/
│   │   ├── Layout.js          # Nav with Storm Cover tab
│   │   ├── StatCard.js
│   │   ├── PolicyCard.js
│   │   ├── ClaimCard.js
│   │   └── WeatherBanner.js
│   ├── pages/
│   │   ├── dashboard.js       # Rider home
│   │   ├── policy.js          # Weekly policy
│   │   ├── demand.js          # ⭐ On-demand coverage
│   │   ├── claims.js          # Claims history
│   │   ├── zones.js           # Zone risk map
│   │   ├── admin.js           # Admin overview
│   │   ├── admin/claims.js    # Claims management
│   │   └── admin/simulate.js  # Flood simulation
│   └── utils/api.js
│
└── ml-service/
    ├── models/
    │   ├── premium_model.py   # GradientBoosting
    │   └── fraud_model.py     # IsolationForest
    └── main.py                # FastAPI endpoints
```

---

## 🚀 Run Locally

```bash
# 1. Clone
git clone https://github.com/vighneshb04/monsoonshield.git
cd monsoonshield

# 2. Setup env
cp backend/.env.example backend/.env
# Edit backend/.env → add your DATABASE_URL and JWT_SECRET

# 3. Database
psql -U postgres -c "CREATE DATABASE monsoonshield;"
psql -U postgres -d monsoonshield -f backend/config/schema.sql
cd backend && node config/seed.js && cd ..

# 4. Install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd ml-service && pip install -r requirements.txt && cd ..

# 5. Run (3 terminals)
cd ml-service && python -m uvicorn main:app --port 8000 --reload
cd backend && npm run dev
cd frontend && npm run dev

# 6. Open http://localhost:3000
```

---

## 📊 Business Viability

| Metric | Value |
|--------|-------|
| Target market | 200,000 Mumbai delivery riders |
| Weekly premium (avg) | ₹75/week |
| On-demand avg transaction | ₹21 |
| Loss ratio target | < 65% |
| Break-even at | 2,000 active riders |
| Revenue at 5% market | ₹75 lakhs/week |

---

## 🔮 What's Next (Phase 3)

- [ ] Real IMD municipal flood API integration
- [ ] Rider Trust Score — dynamic premium reduction for honest riders
- [ ] WhatsApp storm alerts before payout
- [ ] Triple Trigger Stack (weather + traffic + volume)
- [ ] LSTM predictive flood modeling (48hr forecast)
- [ ] IRDAI regulatory sandbox application
- [ ] Direct Zepto/Blinkit rider app embedding

---

*MonsoonShield AI — When it rains, you still get paid.* 🛵🌧️

**Built for Guidewire DEVTrails 2026 | Team: Vighnesh B**
