@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 start.py
) else (
  python start.py
)
if errorlevel 1 (
  echo Install Python 3, then rerun this launcher. The bridge needs a local HTTP server.
  pause
)
