@echo off
rem Run this on a new PC when BDBBC POS will not open.
rem Best results: right-click this file -> "Run as administrator".
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp09-DIAGNOSE-DESKTOP.ps1"
echo.
pause
