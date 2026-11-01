@echo off
title Rockcliff 'B' Block Apartment Management
echo ========================================================
echo   Rockcliff 'B' Block Apartment Management System
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on this computer.
    echo Please download and install Node.js from https://nodejs.org/
    echo and double-click this file again.
    echo.
    pause
    exit /b 1
)

echo Starting application server on port 5174...
start "" http://127.0.0.1:5174
node server.mjs
pause
