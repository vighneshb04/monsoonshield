#!/bin/bash
# Quick start - assumes setup already done
# Usage: ./run.sh

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🌧️  Starting MonsoonShield AI...${NC}"

# Kill any running instances
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "nodemon server" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

sleep 1

# Start ML Service
cd ml-service
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload > ../logs/ml.log 2>&1 &
cd ..

# Start Backend
cd backend
npm run dev > ../logs/backend.log 2>&1 &
cd ..

# Start Frontend
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
cd ..

mkdir -p logs

sleep 3

echo ""
echo -e "${GREEN}🎉 All services started!${NC}"
echo ""
echo -e "  🌐 App:     http://localhost:3000"
echo -e "  🔌 API:     http://localhost:5000"
echo -e "  🤖 ML:      http://localhost:8000/docs"
echo ""
echo -e "  Rider: 9876543210 / rider123"
echo -e "  Admin: 9999999999 / admin123"
echo ""
echo "  Logs: ./logs/"
echo "  Stop: ./stop.sh"
