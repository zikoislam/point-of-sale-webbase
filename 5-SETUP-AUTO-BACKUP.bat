@echo off
title Unique POS - Setup Daily Auto Backup (Task Scheduler)
color 0E

echo.
echo ============================================================
echo   Setting up DAILY AUTO BACKUP at 11:30 PM every night...
echo ============================================================
echo.

set BAT_PATH=%~dp04-BACKUP-NOW.bat

:: Windows Task Scheduler এ ট্যাস্ক তৈরি করো
schtasks /create /tn "Unique POS Daily Backup" /tr "\"%BAT_PATH%\" silent" /sc daily /st 23:30 /f

if errorlevel 1 (
    echo ❌ Failed to create scheduled task.
    echo    Try running this file as Administrator.
) else (
    echo.
    echo ✅ Daily Auto Backup Scheduled!
    echo.
    echo    📅 Schedule: Every day at 11:30 PM
    echo    💾 Backup saves to: %~dp0\backend\backups\
    echo    🗑️  Old backups auto-deleted after 7 days
    echo.
    echo    💡 TIP: Sync the backup folder with Google Drive
    echo       to keep your data safe in the cloud for FREE!
)

echo.
pause
