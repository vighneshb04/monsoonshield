#!/bin/bash
echo "Stopping MonsoonShield services..."
pkill -f "uvicorn main:app" 2>/dev/null && echo "✓ ML service stopped" || echo "ML service not running"
pkill -f "nodemon server"   2>/dev/null && echo "✓ Backend stopped"    || echo "Backend not running"
pkill -f "next dev"         2>/dev/null && echo "✓ Frontend stopped"   || echo "Frontend not running"
echo "Done."
