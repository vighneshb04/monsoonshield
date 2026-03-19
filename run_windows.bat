@echo off
echo Starting MonsoonShield AI on Windows...
echo.

:: Start ML Service
echo Starting ML Service on port 8000...
start "ML Service" cmd /k "cd ml-service && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak

:: Start Backend
echo Starting Backend on port 5000...
start "Backend" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak

:: Start Frontend
echo Starting Frontend on port 3000...
start "Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 4 /nobreak

echo.
echo ================================================
echo  MonsoonShield AI is running!
echo ================================================
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:5000
echo   ML Docs:   http://localhost:8000/docs
echo.
echo   Rider:  9876543210 / rider123
echo   Admin:  9999999999 / admin123
echo ================================================
echo.
pause
