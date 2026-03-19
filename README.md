# 🌧️ MonsoonShield AI
## Hyperlocal Weekly Income Protection for Mumbai Q-Commerce Riders

> **Parametric insurance** powered by real-time rainfall data, AI-based premium calculation, and instant UPI payouts.

---

## 📋 Project Overview

MonsoonShield AI protects Zepto/Blinkit delivery riders in flood-prone Mumbai zones from **loss of income** due to extreme weather. When rainfall exceeds **60mm in 3 hours** or order volume drops by **>40%**, claims are generated **automatically** and paid within minutes — no manual filing required.

### Why Parametric Insurance?
- Traditional insurance requires manual claim filing, assessments, and weeks of waiting
- Parametric insurance triggers payouts automatically based on objective data (rainfall measurements)
- Riders get protected income during floods without bureaucracy

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Next.js       │────▶│  Express API    │────▶│  FastAPI ML      │
│   Frontend      │     │  Backend        │     │  Service         │
│   Port 3000     │     │  Port 5000      │     │  Port 8000       │
└─────────────────┘     └────────┬────────┘     └──────────────────┘
                                  │
                         ┌────────▼────────┐
                         │   PostgreSQL    │
                         │   Database      │
                         └─────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
             ┌──────▼──┐  ┌──────▼──┐  ┌──────▼──┐
             │OpenWeather│  │Delivery │  │Razorpay │
             │API (mock) │  │Vol API  │  │(mock)   │
             └──────────┘  │(mock)   │  └─────────┘
                           └─────────┘
```

### Trigger Flow
```
Every 30 min (cron)
        │
        ▼
  WeatherService.getLatestWeather(zone)
  DeliveryService.getVolumeData(zone)
        │
        ▼
  rainfall ≥ 60mm?  ──────────────────────────────┐
  volume_drop ≥ 40%? ─────────────────────────────┤
        │                                          │
        ▼                                          ▼
  FraudService.checkClaim()              Generate Auto-Claim
        │                                     │
   fraud_score > 7.5? ──── fraud_hold         │
   fraud_score > 5.0? ──── pending            ▼
   fraud_score < 5.0? ──── auto-approve  InstantPayout
                                         (Razorpay mock)
                                              │
                                              ▼
                                         UPI Transfer ✓
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+
- npm / pip3

### 1. Clone and configure

```bash
git clone <repo>
cd monsoonshield

# Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

### 2. Configure backend `.env`

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/monsoonshield
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
JWT_SECRET=change_this_to_something_long_and_random
OPENWEATHER_MOCK=true    # set to false + add API key for real data
ML_SERVICE_URL=http://localhost:8000
```

### 3. Setup database

```bash
# Create DB and run schema
psql -U postgres -c "CREATE DATABASE monsoonshield;"
psql -U postgres -d monsoonshield -f backend/config/schema.sql

# Seed demo data
cd backend && npm install && node config/seed.js && cd ..
```

### 4. Install dependencies

```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# ML Service
cd ml-service && pip3 install -r requirements.txt && cd ..
```

### 5. Run all services

**Linux/Mac:**
```bash
chmod +x setup.sh run.sh stop.sh
./run.sh
```

**Windows:**
```cmd
run_windows.bat
```

**Or manually (3 terminals):**
```bash
# Terminal 1 - ML Service
cd ml-service
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 - Backend
cd backend
npm run dev

# Terminal 3 - Frontend
cd frontend
npm run dev
```

### 6. Open the app
- **Frontend:** http://localhost:3000
- **API:** http://localhost:5000/health
- **ML Docs:** http://localhost:8000/docs

---

## 🔑 Demo Credentials

| Role  | Phone       | Password  |
|-------|-------------|-----------|
| Rider | 9876543210  | rider123  |
| Admin | 9999999999  | admin123  |

---

## 📱 App Pages

| Page | URL | Description |
|------|-----|-------------|
| Login | `/login` | Authentication |
| Register | `/register` | Rider onboarding (2-step) |
| Dashboard | `/dashboard` | Rider home - policy, claims, weather |
| Policy | `/policy` | Buy / view weekly policy |
| Claims | `/claims` | Claims history + payouts |
| Zones | `/zones` | Zone risk map |
| Admin | `/admin` | Platform overview |
| Admin Claims | `/admin/claims` | Manage all claims |
| Simulate | `/admin/simulate` | Flood simulation console |

---

## 🎮 Demo Simulation Flow

1. Login as **Admin** (9999999999 / admin123)
2. Go to **Simulate** page (`/admin/simulate`)
3. Select zone **Kurla** (highest risk)
4. Click **"⚡ Simulate Flood"**
5. Watch the log console:
   - Weather data injected (85mm)
   - Volume drop recorded (55%)
   - Claims auto-generated for active policies
   - Fraud detection runs
   - Instant payouts sent
6. Go to **Admin Dashboard** → see updated metrics
7. Go to **Admin Claims** → see new claims
8. Login as **Rider** → see claim received

---

## 💰 Premium Formula

```
Weekly Premium = BaseRate + (FloodRiskScore × ZoneMultiplier) - SafetyDiscount

Where:
  BaseRate        = CoverageAmount × 3%
  FloodRiskScore  = 0-10 (zone historical data)
  ZoneMultiplier  = 1.45 - 1.85 (zone pricing factor)
  SafetyDiscount  = 20% of BaseRate if zero past claims

Example (Kurla, ₹2000 coverage):
  BaseRate        = ₹60
  Risk Component  = 8.5 × 1.85 × 0.9 = ₹14.14
  Safety Discount = ₹12 (no claims)
  Weekly Premium  = ₹62.14
```

---

## 🤖 ML Models

### Premium Model (GradientBoostingRegressor)
- Features: flood_risk_score, zone_multiplier, coverage_amount, rider_risk_score, rainfall_mm, past_claims
- Target: weekly_premium
- Training data: 2000 synthetic samples based on Mumbai actuarial assumptions

### Fraud Model (IsolationForest)
- Features: claim_amount, rainfall_mm, claims_last_30d, avg_claim_amount, days_since_policy_start
- Contamination: 8% (expected fraud rate)
- Output: fraud_score 0-10 + flags

---

## 🌐 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register rider |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/zones` | JWT | Get all zones |
| GET | `/api/premium/calculate` | JWT | AI premium calc |
| POST | `/api/policy/create` | JWT | Create policy |
| GET | `/api/claim/my` | JWT | Rider's claims |
| GET | `/api/claim/all` | Admin | All claims |
| POST | `/api/payout/process` | Admin | Process payout |
| GET | `/api/dashboard/worker` | JWT | Rider dashboard |
| GET | `/api/dashboard/admin` | Admin | Admin dashboard |
| POST | `/api/trigger/simulate-flood` | Admin | Demo simulation |

---

## 🚀 Deployment

### Vercel (Frontend)
```bash
cd frontend
npx vercel --prod
# Set env: NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

### Render (Backend)
1. Create new Web Service
2. Root: `backend/`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables from `.env`

### Render (ML Service)
1. Create new Web Service
2. Root: `ml-service/`
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Supabase / Neon (PostgreSQL)
- Create a free PostgreSQL database
- Run `schema.sql`
- Copy connection string to `DATABASE_URL`

---

## 📁 Project Structure

```
monsoonshield/
├── backend/
│   ├── config/
│   │   ├── db.js           # PostgreSQL pool
│   │   ├── schema.sql      # Complete DB schema
│   │   └── seed.js         # Demo data seeder
│   ├── middleware/
│   │   └── auth.js         # JWT middleware
│   ├── routes/
│   │   ├── auth.js         # Register/Login
│   │   ├── zones.js        # Zone data
│   │   ├── premium.js      # Premium calculation
│   │   ├── policy.js       # Policy CRUD
│   │   ├── trigger.js      # Parametric triggers
│   │   ├── claim.js        # Claims management
│   │   ├── payout.js       # Payout processing
│   │   ├── dashboard.js    # Dashboard APIs
│   │   └── weather.js      # Weather data
│   ├── services/
│   │   ├── triggerEngine.js  # Core parametric engine
│   │   ├── weatherService.js # OpenWeather + mock
│   │   ├── deliveryService.js# Order volume simulation
│   │   └── fraudService.js   # Fraud detection
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── components/
│   │   └── dashboard/
│   │       ├── Layout.js
│   │       ├── StatCard.js
│   │       ├── PolicyCard.js
│   │       ├── ClaimCard.js
│   │       └── WeatherBanner.js
│   ├── hooks/
│   │   └── useAuth.js
│   ├── pages/
│   │   ├── index.js         # Redirect
│   │   ├── login.js
│   │   ├── register.js
│   │   ├── dashboard.js     # Rider dashboard
│   │   ├── policy.js
│   │   ├── claims.js
│   │   ├── zones.js
│   │   ├── admin.js         # Admin dashboard
│   │   └── admin/
│   │       ├── claims.js
│   │       └── simulate.js
│   ├── styles/
│   │   └── globals.css
│   ├── utils/
│   │   └── api.js
│   └── package.json
│
├── ml-service/
│   ├── models/
│   │   ├── premium_model.py  # GradientBoosting
│   │   └── fraud_model.py    # IsolationForest
│   ├── data/                 # Saved model files
│   ├── main.py               # FastAPI app
│   └── requirements.txt
│
├── setup.sh     # Full setup script
├── run.sh       # Start all services
├── stop.sh      # Stop all services
├── run_windows.bat
└── README.md
```

---

## 🏆 Hackathon Notes

- **Income protection only** — no health/vehicle coverage
- **Weekly pricing** — policies renew every 7 days
- **Parametric triggers** — objective, not manual claims
- **Instant payouts** — sub-minute UPI simulation
- **AI-powered** — both premium and fraud use ML models
- All external APIs (OpenWeather, Razorpay) have mock fallbacks

---

*Built with ❤️ for Mumbai's delivery heroes. Stay safe, stay covered.* 🛵🌧️
