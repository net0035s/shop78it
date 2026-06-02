@echo off
echo ============================================
echo   ShopAuto 24/7 — Setup Script
echo ============================================
echo.

cd /d "n:\ทำเว็บขาย24.7"

echo [1/2] Installing dependencies...
npm install

echo.
echo [2/2] Starting development server...
echo.
echo Open your browser at: http://localhost:3000
echo.
npm run dev
