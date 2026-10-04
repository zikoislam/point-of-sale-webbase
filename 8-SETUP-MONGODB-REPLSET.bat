@echo off
setlocal EnableDelayedExpansion

rem ===========================================================================
rem  MongoDB -> single-node replica set (rs0)
rem
rem  কেন দরকার: BDBBC POS checkout/return-এ ACID transaction ব্যবহার করে, আর
rem  MongoDB transaction শুধু replica set-এ চলে। সাধারণ MSI ইনস্টল standalone
rem  হয়, তাই এটা একবার চালিয়ে replica set চালু করতে হয়।
rem
rem  চালান:  এই ফাইলে Right-click -> "Run as administrator"
rem ===========================================================================

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo  এই ফাইলটা Administrator হিসেবে চালান ^(Right-click -^> Run as administrator^).
  echo.
  pause
  exit /b 1
)

set "SRV=C:\Program Files\MongoDB\Server"
if not exist "%SRV%" (
  echo.
  echo  MongoDB Server পাওয়া যায়নি: "%SRV%"
  echo  আগে MongoDB Community Server MSI ইনস্টল করুন ^("Install MongoDB as a Service" টিক দিয়ে^).
  echo.
  pause
  exit /b 1
)

rem সবচেয়ে নতুন version ফোল্ডার বেছে নিন
set "VERDIR="
for /f "delims=" %%D in ('dir /b /ad /o-n "%SRV%" 2^>nul') do (
  if not defined VERDIR set "VERDIR=%SRV%\%%D"
)

set "CFG=%VERDIR%\bin\mongod.cfg"
if not exist "%CFG%" (
  echo  mongod.cfg পাওয়া যায়নি: "%CFG%"
  pause
  exit /b 1
)

echo.
echo  Config: %CFG%
echo.

findstr /i /c:"replSetName" "%CFG%" >nul 2>&1
if not errorlevel 1 (
  echo  replSetName আগে থেকেই আছে — config বদলানো হয়নি.
) else (
  copy /y "%CFG%" "%CFG%.bak" >nul
  echo.>>"%CFG%"
  echo replication:>>"%CFG%"
  echo   replSetName: rs0>>"%CFG%"
  echo  [OK] mongod.cfg-এ replication.replSetName=rs0 যোগ করা হয়েছে ^(backup: mongod.cfg.bak^).
)

echo.
echo  MongoDB service restart করা হচ্ছে...
net stop MongoDB >nul 2>&1
net start MongoDB >nul 2>&1
timeout /t 4 /nobreak >nul

set "SHELL="
if exist "%VERDIR%\bin\mongosh.exe" set "SHELL=%VERDIR%\bin\mongosh.exe"
if not defined SHELL if exist "%VERDIR%\bin\mongo.exe" set "SHELL=%VERDIR%\bin\mongo.exe"

if not defined SHELL (
  echo  mongosh/mongo shell পাওয়া যায়নি.
  echo  ম্যানুয়ালি চালান:  mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
  echo.
  pause
  exit /b 0
)

echo.
echo  Replica set চালু করা হচ্ছে...
"%SHELL%" --quiet --eval "try { if (rs.status().ok) { print('already initiated'); } } catch(e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]}); print('initiated rs0'); }"

echo.
echo  শেষ. MongoDB এখন single-node replica set (rs0) হিসেবে চলছে — transactions কাজ করবে.
echo.
pause
