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
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=12)?0:1)"
if errorlevel 1 (
  echo ERROR: Node.js 22.12 or newer is required for this release build.
  echo Install the current Node.js LTS, reopen Command Prompt, and try again.
  pause
  exit /b 1
)
for /f "delims=" %%V in ('powershell -NoProfile -Command "(Get-Content package.json -Raw | ConvertFrom-Json).version"') do set "APP_VERSION=%%V"
if not defined APP_VERSION (
  echo ERROR: Could not read the desktop version from package.json.
  pause
  exit /b 1
)

echo.
if defined CSC_LINK (
  echo Code signing certificate detected. The installer will be signed.
) else (
  echo WARNING: No CSC_LINK certificate was found.
  echo This build is for private testing only and must not be published.
)

echo.
echo Installing dependencies...
call npm ci
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
echo Checking release security configuration...
call npm run check:release
if errorlevel 1 (
  echo.
  echo ERROR: Release security configuration check failed.
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

call npm run check:packaged -- "release\win-unpacked\INX Social.exe"
if errorlevel 1 (
  echo ERROR: Packaged ASAR or Electron fuse verification failed.
  pause
  exit /b 1
)

powershell -NoProfile -Command "$f=Get-Item ('release\INX-Social-Setup-' + $env:APP_VERSION + '.exe') -ErrorAction SilentlyContinue; if(-not $f){exit 1}; $h=(Get-FileHash $f.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); Set-Content -Encoding Ascii -Path ($f.FullName + '.sha256') -Value ($h + '  ' + $f.Name); Write-Host ('SHA-256: ' + $h)"
if errorlevel 1 (
  echo ERROR: Installer checksum could not be created.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo DONE.
echo Your installer should be inside the release folder:
echo %cd%\release
echo The matching .sha256 file is in the same folder.
echo ============================================================
echo.
pause
