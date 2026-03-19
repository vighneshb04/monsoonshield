# MonsoonShield AI — All Commands Reference

## ═══════════════════════════════════════
## PREREQUISITES INSTALL
## ═══════════════════════════════════════

### Ubuntu / Debian
```bash
# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python 3.11
sudo apt-get install -y python3 python3-pip

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS (Homebrew)
```bash
brew install node@18 python@3.11 postgresql@15
brew services start postgresql@15
```

### Windows
- Node.js: https://nodejs.org (download LTS installer)
- Python: https://python.org (download 3.11+, check "Add to PATH")
- PostgreSQL: https://postgresql.org/download/windows/


## ═══════════════════════════════════════
## STEP 1: DATABASE SETUP
## ═══════════════════════════════════════

```bash
# Create PostgreSQL user (if needed)
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"

# Create database
psql -U postgres -c "CREATE DATABASE monsoonshield;"

# Run schema (creates all tables + seeds zones)
psql -U postgres -d monsoonshield -f backend/config/schema.sql

# Verify tables created
psql -U postgres -d monsoonshield -c "\dt"
```

Expected output: 9 tables (users, zones, policies, premium_history,
weather_data, claims, fraud_logs, payouts, delivery_volume_logs)


## ═══════════════════════════════════════
## STEP 2: ENVIRONMENT CONFIGURATION
## ═══════════════════════════════════════

```bash
# Backend env
cp backend/.env.example backend/.env

# Edit backend/.env — minimum required changes:
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/monsoonshield
# DB_PASSWORD=YOUR_PASSWORD
# JWT_SECRET=any_long_random_string_here

# Frontend env
cp frontend/.env.local.example frontend/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:5000/api  (already correct)
```


## ═══════════════════════════════════════
## STEP 3: INSTALL DEPENDENCIES
## ═══════════════════════════════════════

```bash
# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..

# ML Service
cd ml-service
pip3 install -r requirements.txt
# OR on some systems:
pip install -r requirements.txt
cd ..
```


## ═══════════════════════════════════════
## STEP 4: SEED DEMO DATA
## ═══════════════════════════════════════

```bash
cd backend
node config/seed.js
cd ..
```

Expected output:
  ✅ Users seeded
  ✅ Weather data seeded
  🎉 Seeding complete!
  Demo Credentials:
    Rider: phone=9876543210, password=rider123
    Admin: phone=9999999999, password=admin123


## ═══════════════════════════════════════
## STEP 5: START SERVICES
## ═══════════════════════════════════════

### Option A: One command (Linux/Mac)
```bash
chmod +x run.sh
./run.sh
```

### Option B: Windows batch
```cmd
run_windows.bat
```

### Option C: Docker Compose (easiest)
```bash
docker-compose up --build
# Seeds run automatically
```

### Option D: Manual (3 separate terminals)

**Terminal 1 — ML Service:**
```bash
cd ml-service
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Wait for: "✅ ML models ready"

**Terminal 2 — Backend:**
```bash
cd backend
npm run dev
```
Wait for: "✅ MonsoonShield Backend running on port 5000"

**Terminal 3 — Frontend:**
```bash
cd frontend
npm run dev
```
Wait for: "ready - started server on http://localhost:3000"


## ═══════════════════════════════════════
## STEP 6: VERIFY EVERYTHING WORKS
## ═══════════════════════════════════════

```bash
# Health checks
curl http://localhost:5000/health
curl http://localhost:8000/health

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","password":"rider123"}'

# Test zones
curl http://localhost:5000/api/zones \
  -H "Authorization: Bearer YOUR_TOKEN_FROM_LOGIN"
```


## ═══════════════════════════════════════
## DEMO SIMULATION COMMANDS
## ═══════════════════════════════════════

### Via API (admin token required):

```bash
# Get admin token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9999999999","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "Admin token: $ADMIN_TOKEN"

# Get zone IDs
curl http://localhost:5000/api/zones \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool

# Simulate flood for Kurla (replace ZONE_ID with actual UUID from above)
ZONE_ID="paste-kurla-zone-id-here"

curl -X POST http://localhost:5000/api/trigger/simulate-flood \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"zone_id\": \"$ZONE_ID\"}"

# Check trigger status
curl -X POST http://localhost:5000/api/trigger/check \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"zone_id\": \"$ZONE_ID\"}"

# View generated claims
curl http://localhost:5000/api/claim/all \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool

# Process payout for a claim (replace CLAIM_ID)
curl -X POST http://localhost:5000/api/payout/process \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"claim_id": "paste-claim-id-here"}'
```

### Via UI:
1. Open http://localhost:3000
2. Login as Admin: 9999999999 / admin123
3. Navigate to Simulate page
4. Select zone → Click "⚡ Simulate Flood"
5. Watch the log console fill in real-time
6. Navigate to Claims → see auto-generated claims


## ═══════════════════════════════════════
## ML SERVICE COMMANDS
## ═══════════════════════════════════════

```bash
# Interactive API docs
open http://localhost:8000/docs

# Test premium calculation
curl -X POST http://localhost:8000/calculate-premium \
  -H "Content-Type: application/json" \
  -d '{
    "flood_risk_score": 8.5,
    "zone_multiplier": 1.85,
    "coverage_amount": 2000,
    "rider_risk_score": 4.5,
    "rainfall_mm": 25,
    "rainfall_24h": 80,
    "past_claims": 0
  }'

# Test fraud detection
curl -X POST http://localhost:8000/fraud-detect \
  -H "Content-Type: application/json" \
  -d '{
    "features": {
      "claim_amount": 2800,
      "rainfall_mm": 10,
      "claims_last_30d": 5,
      "avg_claim_amount": 2700,
      "days_since_policy_start": 1,
      "trigger_type_encoded": 1
    }
  }'

# Retrain models
curl -X POST http://localhost:8000/retrain
```


## ═══════════════════════════════════════
## DATABASE COMMANDS
## ═══════════════════════════════════════

```bash
# Connect to database
psql -U postgres -d monsoonshield

# View all tables
\dt

# View users
SELECT id, full_name, phone, platform, is_verified FROM users;

# View zones with risk scores
SELECT name, flood_risk_score, zone_multiplier FROM zones ORDER BY flood_risk_score DESC;

# View active policies
SELECT p.policy_number, u.full_name, p.coverage_amount, p.weekly_premium, p.status
FROM policies p JOIN users u ON u.id = p.user_id WHERE p.status = 'active';

# View all claims
SELECT c.claim_number, u.full_name, c.trigger_type, c.claim_amount, c.status, c.fraud_score
FROM claims c JOIN users u ON u.id = c.user_id ORDER BY c.created_at DESC;

# View payouts
SELECT payout_number, amount, status, completed_at FROM payouts;

# Reset demo data (dangerous!)
TRUNCATE claims, payouts, fraud_logs, premium_history, policies, delivery_volume_logs, weather_data CASCADE;

# Exit psql
\q
```


## ═══════════════════════════════════════
## TROUBLESHOOTING
## ═══════════════════════════════════════

### "Cannot connect to database"
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql   # Linux
brew services list | grep postgres  # Mac

# Check connection
psql -U postgres -c "SELECT 1;"

# Reset password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

### "Port already in use"
```bash
# Kill process on port
lsof -ti:5000 | xargs kill -9   # backend
lsof -ti:3000 | xargs kill -9   # frontend
lsof -ti:8000 | xargs kill -9   # ml service

# Or use stop script
./stop.sh
```

### "ML service not responding" (premium/fraud fallbacks to rule-based)
```bash
# Restart ML service
cd ml-service
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Check health
curl http://localhost:8000/health
```

### "Module not found" (Python)
```bash
cd ml-service
pip3 install scikit-learn numpy pandas fastapi uvicorn joblib pydantic
```

### "npm ERR! " 
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Frontend shows "Failed to load dashboard"
- Ensure backend is running on port 5000
- Check `frontend/.env.local` has correct `NEXT_PUBLIC_API_URL`
- Check browser console for CORS errors


## ═══════════════════════════════════════
## DEPLOYMENT COMMANDS
## ═══════════════════════════════════════

### Deploy Frontend to Vercel
```bash
cd frontend
npx vercel login
npx vercel --prod
# When prompted, set:
# NEXT_PUBLIC_API_URL = https://your-backend.onrender.com/api
```

### Deploy Backend to Render
```bash
# In Render dashboard:
# Service type: Web Service
# Root directory: backend
# Build command: npm install
# Start command: node server.js
# Add all env variables from backend/.env
```

### Deploy ML Service to Render
```bash
# Service type: Web Service
# Root directory: ml-service
# Build command: pip install -r requirements.txt
# Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Free PostgreSQL options
- Supabase: https://supabase.com (500MB free)
- Neon: https://neon.tech (0.5GB free)
- Railway: https://railway.app ($5 credit free)
