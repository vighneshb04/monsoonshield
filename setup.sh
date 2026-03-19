#!/bin/bash
# ============================================================
# MonsoonShield AI - Master Setup & Run Script
# ============================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🌧️  MonsoonShield AI - Setup Script${NC}"
echo "============================================"
echo ""

# ─── Check prerequisites ─────────────────────────────────────
echo -e "${YELLOW}Checking prerequisites...${NC}"

check_cmd() {
  if ! command -v $1 &> /dev/null; then
    echo -e "${RED}❌ $1 not found. Please install $1 first.${NC}"
    exit 1
  else
    echo -e "${GREEN}✓ $1 found${NC}"
  fi
}

check_cmd node
check_cmd npm
check_cmd python3
check_cmd pip3
check_cmd psql

echo ""

# ─── Parse arguments ─────────────────────────────────────────
MODE=${1:-"all"}   # all | backend | frontend | ml | db

# ─── Database setup ──────────────────────────────────────────
setup_db() {
  echo -e "${BLUE}Setting up PostgreSQL database...${NC}"

  if [ -f "backend/.env" ]; then
    source <(grep -v '^#' backend/.env | sed 's/=/ /' | awk '{print "export " $1 "=" $2}')
  fi

  DB_NAME=${DB_NAME:-monsoonshield}
  DB_USER=${DB_USER:-postgres}

  # Create database
  psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "  Database may already exist, continuing..."

  # Run schema
  psql -U "$DB_USER" -d "$DB_NAME" -f backend/config/schema.sql
  echo -e "${GREEN}✓ Database schema created${NC}"

  # Seed data
  cd backend && node config/seed.js && cd ..
  echo -e "${GREEN}✓ Database seeded${NC}"
}

# ─── Backend setup ───────────────────────────────────────────
setup_backend() {
  echo -e "${BLUE}Setting up backend...${NC}"
  cd backend

  # Copy .env if not exists
  if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Created backend/.env from example. Please update DATABASE_URL!${NC}"
  fi

  npm install
  echo -e "${GREEN}✓ Backend dependencies installed${NC}"
  cd ..
}

# ─── Frontend setup ──────────────────────────────────────────
setup_frontend() {
  echo -e "${BLUE}Setting up frontend...${NC}"
  cd frontend

  if [ ! -f ".env.local" ]; then
    cp .env.local.example .env.local
    echo -e "${GREEN}✓ Created frontend/.env.local${NC}"
  fi

  npm install
  echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
  cd ..
}

# ─── ML service setup ────────────────────────────────────────
setup_ml() {
  echo -e "${BLUE}Setting up ML service...${NC}"
  cd ml-service

  if [ ! -f ".env" ]; then
    echo "PORT=8000" > .env
  fi

  pip3 install -r requirements.txt -q
  echo -e "${GREEN}✓ ML dependencies installed${NC}"
  cd ..
}

# ─── Run all services ────────────────────────────────────────
run_all() {
  echo ""
  echo -e "${BLUE}Starting all services...${NC}"
  echo ""

  # ML service
  echo -e "${GREEN}Starting ML service on port 8000...${NC}"
  cd ml-service && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
  ML_PID=$!
  cd ..

  sleep 2

  # Backend
  echo -e "${GREEN}Starting backend on port 5000...${NC}"
  cd backend && npm run dev &
  BACKEND_PID=$!
  cd ..

  sleep 2

  # Frontend
  echo -e "${GREEN}Starting frontend on port 3000...${NC}"
  cd frontend && npm run dev &
  FRONTEND_PID=$!
  cd ..

  echo ""
  echo -e "${GREEN}============================================${NC}"
  echo -e "${GREEN}🎉 MonsoonShield AI is running!${NC}"
  echo -e "${GREEN}============================================${NC}"
  echo ""
  echo -e "  🌐 Frontend:   ${BLUE}http://localhost:3000${NC}"
  echo -e "  🔌 Backend:    ${BLUE}http://localhost:5000${NC}"
  echo -e "  🤖 ML Service: ${BLUE}http://localhost:8000${NC}"
  echo -e "  📚 ML Docs:    ${BLUE}http://localhost:8000/docs${NC}"
  echo ""
  echo -e "  Demo Login (Rider): ${YELLOW}9876543210 / rider123${NC}"
  echo -e "  Demo Login (Admin): ${YELLOW}9999999999 / admin123${NC}"
  echo ""
  echo -e "  Press ${RED}Ctrl+C${NC} to stop all services"
  echo ""

  # Wait and cleanup on exit
  trap "kill $ML_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Services stopped.'" EXIT
  wait
}

# ─── Main ────────────────────────────────────────────────────
case $MODE in
  "setup")
    setup_backend
    setup_frontend
    setup_ml
    setup_db
    echo ""
    echo -e "${GREEN}✅ Setup complete! Run ./run.sh to start services.${NC}"
    ;;
  "db")
    setup_db
    ;;
  "backend")
    setup_backend
    ;;
  "frontend")
    setup_frontend
    ;;
  "ml")
    setup_ml
    ;;
  "all"|*)
    setup_backend
    setup_frontend
    setup_ml
    run_all
    ;;
esac
