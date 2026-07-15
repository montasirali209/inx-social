@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo INX Social - Run App
echo ============================================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Install Node.js LTS from https://nodejs.org then run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run detected. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo Starting dashboard...
call npm start
pause
