@echo off
rem Double-click to run the app on this laptop. Connect an adapter from Settings (swipe down),
rem or open http://localhost:5173/?sim for simulated data.
title OBD Gauges
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org
  echo then restart the laptop and run this again.
  pause
  exit /b 1
)

echo Checking packages (the first run takes a minute)...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  echo.
  echo Installing packages failed. The message above says why.
  pause
  exit /b 1
)

rem Open the browser a few seconds from now, once the server is up.
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:5173/"

echo.
echo Running at http://localhost:5173/  (add ?sim to the address for simulated data)
echo Keep this window open while you use the app. Close it to stop.
echo.
call npm run dev
echo.
echo The app stopped. The message above says why.
echo If it says port 5173 is already in use, another copy is still running:
echo close the other black window, then run this again.
pause
