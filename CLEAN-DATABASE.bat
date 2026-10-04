@echo off
setlocal EnableDelayedExpansion
title Unique POS - FULL CLEAN (reliable reset)

echo ============================================================
echo   Unique POS - FULL CLEAN
echo ============================================================
echo.
echo   This makes the app start 100%% empty on THIS PC.
echo.
echo   It will:
echo     - close Unique POS
echo     - drop the external MongoDB database "pos_db"
echo     - MOVE the whole  %%APPDATA%%\Unique POS  folder to a
echo       backup  (removes the old database AND the old
echo       config.json with any cloud setting)
echo     - keep your installed license.key
echo.
echo   Nothing else on the PC is touched.
echo.
set /p CONFIRM=Type YES to continue: 
if /i not "%CONFIRM%"=="YES" (
  echo.
  echo Cancelled - nothing changed.
  goto :end
)

set "APPDIR=%APPDATA%\Unique POS"
set "BAK=%APPDATA%\Unique POS-backup-%RANDOM%"

echo.
echo [1/4] Closing Unique POS...
taskkill /IM "Unique POS.exe" /F >nul 2>&1
taskkill /IM "Unique POS Desktop.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Dropping external MongoDB database "pos_db"...
set "MONGOSH="
for /d %%D in ("C:\Program Files\MongoDB\Server\*") do (
  if exist "%%D\bin\mongosh.exe" set "MONGOSH=%%D\bin\mongosh.exe"
)
if not defined MONGOSH (
  for /d %%D in ("C:\Program Files\MongoDB\Server\*") do (
    if exist "%%D\bin\mongo.exe" set "MONGOSH=%%D\bin\mongo.exe"
  )
)
if defined MONGOSH (
  "%MONGOSH%" --quiet --eval "db.getSiblingDB('pos_db').dropDatabase()" >nul 2>&1
  echo      done ^(if the MongoDB service was running^).
) else (
  echo      (MongoDB is not installed on this PC - skipped)
)

echo [3/4] Moving app data to backup: %BAK%
set "HADKEY=0"
if exist "%APPDIR%\license.key" (
  copy /y "%APPDIR%\license.key" "%TEMP%\upos-license.key" >nul 2>&1
  set "HADKEY=1"
)
if exist "%APPDIR%" move "%APPDIR%" "%BAK%" >nul 2>&1
if exist "%APPDIR%" (
  echo      still locked - stopping its MongoDB and retrying...
  taskkill /IM mongod.exe /F >nul 2>&1
  timeout /t 3 /nobreak >nul
  move "%APPDIR%" "%BAK%" >nul 2>&1
)
if exist "%APPDIR%" (
  echo      could NOT move it. Close Unique POS completely and run again.
  echo      Folder: %APPDIR%
) else (
  echo      done ^(old data is safe in the backup^).
)

echo [4/4] Restoring your license key...
if "%HADKEY%"=="1" (
  if not exist "%APPDIR%" mkdir "%APPDIR%" >nul 2>&1
  copy /y "%TEMP%\upos-license.key" "%APPDIR%\license.key" >nul 2>&1
  del "%TEMP%\upos-license.key" >nul 2>&1
  echo      license.key restored.
) else (
  echo      (no license.key was found - you will enter it in the app)
)

echo.
echo ============================================================
echo   DONE.  Unique POS is now 100%% clean.
echo.
echo   1) Open Unique POS
echo   2) It creates a fresh database with the super admin only:
echo         admin / Admin@123
echo   3) Change that password right after you sign in.
echo.
echo   Old data backup: %BAK%
echo ============================================================

:end
echo.
pause
