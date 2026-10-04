@echo off
title BDBBC POS - Auto Backup
color 0B

echo.
echo ============================================================
echo    BDBBC POS - Daily Backup System
echo    Backup Time: %date% %time%
echo ============================================================
echo.

:: Backup ফোল্ডারের পাথ
set BACKUP_DIR=%~dp0\backend\backups
set DATE_FOLDER=%BACKUP_DIR%\%date:~6,4%-%date:~3,2%-%date:~0,2%
set LOCAL_URI=mongodb://127.0.0.1:27017/pos_db

:: তারিখ অনুযায়ী ফোল্ডার তৈরি
if not exist "%DATE_FOLDER%" mkdir "%DATE_FOLDER%"

echo Backing up database to: %DATE_FOLDER%
echo.

mongodump --uri="%LOCAL_URI%" --out="%DATE_FOLDER%"

if errorlevel 1 (
    echo ❌ Backup FAILED! MongoDB might not be running.
) else (
    echo.
    echo ✅ Backup successful!
    echo    Location: %DATE_FOLDER%
    echo.
    
    :: ৭ দিনের বেশি পুরনো ব্যাকআপ মুছে দাও
    forfiles /p "%BACKUP_DIR%" /d -7 /c "cmd /c if @isdir==TRUE rd /s /q @path" 2>nul
    echo 🗑️  Old backups (7+ days) cleaned up.
)

echo.
echo ============================================================
echo   💡 TIP: Google Drive এ ব্যাকআপ ফোল্ডারটি সিঙ্ক করুন
echo   Location: %BACKUP_DIR%
echo ============================================================
echo.

:: যদি সরাসরি রান করা হয় (Task Scheduler নয়)
if not "%1"=="silent" pause
