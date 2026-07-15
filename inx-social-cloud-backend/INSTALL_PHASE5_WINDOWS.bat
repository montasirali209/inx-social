@echo off
setlocal
cd /d "%~dp0"
echo.
echo ==============================================
echo INX Social Phase 5A + 5B Backend Setup
echo ==============================================
echo.
call npm config set registry https://registry.npmjs.org/
call npm config delete proxy >nul 2>&1
call npm config delete https-proxy >nul 2>&1
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
call npm install --no-audit --no-fund
if errorlevel 1 goto :error
call npm run prisma:generate
if errorlevel 1 goto :error
call npm run prisma:migrate
if errorlevel 1 goto :error
call npm run seed
if errorlevel 1 goto :error
echo.
echo Setup complete. Starting INX Social Cloud...
call npm start
goto :eof
:error
echo.
echo Setup failed. Review the error above.
pause
exit /b 1
