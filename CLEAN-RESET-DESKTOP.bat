@echo off
rem Clean reset of BDBBC POS desktop data (fresh database).
rem Best results: right-click this file -> "Run as administrator".
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CLEAN-RESET-DESKTOP.ps1"
echo.
pause
