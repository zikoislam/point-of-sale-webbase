@echo off
title Unique POS - Server Starting...
color 0A

echo.
echo ============================================================
echo    UNIQUE POS SYSTEM - LOCAL SERVER
echo    Developed by Bdbbc.com - Zakirul Islam
echo ============================================================
echo.

:: MongoDB সার্ভিস চলছে কিনা চেক করা
sc query MongoDB | find "RUNNING" >nul 2>&1
if errorlevel 1 (
    echo [1/3] Starting MongoDB Service...
    net start MongoDB
    timeout /t 3 /nobreak >nul
) else (
    echo [1/3] MongoDB is already running ✅
)

echo.
echo [2/3] Starting Backend API Server (Port 5000)...
start "POS Backend" cmd /k "cd /d "%~dp0\backend" && node dist/server.js"

timeout /t 3 /nobreak >nul

echo.
echo [3/3] Starting Frontend Server (Port 3000)...
start "POS Frontend" cmd /k "cd /d "%~dp0\frontend" && npx serve out -p 3000 -s"

timeout /t 4 /nobreak >nul

echo.
echo ============================================================
echo   ✅ UNIQUE POS IS RUNNING!
echo.
echo   📍 LOCAL ACCESS (Same PC):
echo      http://localhost:3000
echo.
echo   📡 NETWORK ACCESS (Same WiFi/LAN):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%
echo      http://%IP%:3000
echo.
echo   🌐 REMOTE ACCESS (via Tailscale):
echo      Install Tailscale first, then use Tailscale IP
echo      Guide: https://tailscale.com/download
echo.
echo   ⚠️  এই উইন্ডো বন্ধ করবেন না! সার্ভার চলতে থাকবে।
echo ============================================================
echo.
pause
