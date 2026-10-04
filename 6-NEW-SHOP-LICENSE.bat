@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Unique POS - New Shop License
echo   (Model C: one install per company)
echo ============================================
echo.

set "SHOP="
set /p SHOP=Shop / customer name: 
if "%SHOP%"=="" (
  echo.
  echo Shop name is required.
  pause
  exit /b 1
)

echo Valid period:
echo    1) 1 month
echo    2) 3 months
echo    3) 6 months
echo    4) 12 months
echo    অথবা সরাসরি সংখ্যা লিখুন ^(যেমন 18 = 18 months^)
echo.

set "CHOICE="
set /p CHOICE=Choose 1-4 or type months [4]: 
if "%CHOICE%"=="" set "CHOICE=4"

set "MONTHS="
if "%CHOICE%"=="1" set "MONTHS=1"
if "%CHOICE%"=="2" set "MONTHS=3"
if "%CHOICE%"=="3" set "MONTHS=6"
if "%CHOICE%"=="4" set "MONTHS=12"
if not defined MONTHS set "MONTHS=%CHOICE%"

set "MACHINE="
set /p MACHINE=Machine ID (Enter = any PC): 

echo.
if "%MACHINE%"=="" (
  node "tools\license-generator\new-shop.js" --shop "%SHOP%" --months %MONTHS%
) else (
  node "tools\license-generator\new-shop.js" --shop "%SHOP%" --months %MONTHS% --machine "%MACHINE%"
)

echo.
pause
