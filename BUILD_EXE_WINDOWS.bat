@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo INX Social - Windows EXE Builder
echo ============================================================
echo.
echo This will install dependencies and build the Windows installer.
echo You need internet connection for the first build because Electron
echo downloads the Windows desktop runtime.
echo.

echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo Install Node.js LTS from https://nodejs.org then run this again.
  pause
  exit /b 1
)
node --version

echo.
echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: npm install failed.
  pause
  exit /b 1
)

echo.
echo Running syntax check...
call npm run lint
if errorlevel 1 (
  echo.
  echo ERROR: Syntax check failed.
  pause
  exit /b 1
)

echo.
echo Building Windows installer EXE...
call npm run dist
if errorlevel 1 (
  echo.
  echo ERROR: EXE build failed.
  echo Common fixes:
  echo - Check your internet connection.
  echo - Temporarily disable VPN/firewall blocking GitHub/Electron downloads.
  echo - Run Command Prompt as Administrator and try again.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo DONE.
echo Your installer should be inside the release folder:
echo %cd%\release
echo ============================================================
echo.
pause
