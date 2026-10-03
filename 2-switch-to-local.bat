@echo off
title Unique POS - Switching to Local Database
color 0A

echo.
echo ============================================================
echo    Switching backend to LOCAL MongoDB...
echo ============================================================
echo.

cd /d "%~dp0\backend"

:: .env ফাইল লোকাল MongoDB তে আপডেট করা
echo Updating .env file...

powershell -Command "(Get-Content .env) -replace 'MONGODB_URI=.*', 'MONGODB_URI=mongodb://127.0.0.1:27017/pos_db' | Set-Content .env"

echo.
echo ✅ Done! Backend is now configured to use LOCAL MongoDB.
echo.
echo ============================================================
echo    Your .env has been updated:
echo    MONGODB_URI=mongodb://127.0.0.1:27017/pos_db
echo ============================================================
echo.
pause
