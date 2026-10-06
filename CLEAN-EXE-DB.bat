@echo off
rem ============================================================
rem  BDBBC POS (offline .exe) - CLEAN the database on THIS PC
rem  Run on the PC whose data you want to wipe (e.g. a new PC
rem  before handing it to the shop).
rem
rem  Best: right-click this file -> "Run as administrator".
rem ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CLEAN-EXE-DB.ps1"
echo.
pause
