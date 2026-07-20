@echo off
setlocal
cd /d "%~dp0.."
call BUILD_EXE_WINDOWS.bat
exit /b %errorlevel%
