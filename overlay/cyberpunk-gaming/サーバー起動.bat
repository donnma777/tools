@echo off
cd /d "%~dp0"
title Overlay Local Server

where python >nul 2>nul
if errorlevel 1 (
    echo Python was not found on this PC.
    echo This tool needs Python to run a local preview server.
    echo Download and install it from: https://www.python.org/downloads/
    echo ^(Be sure to check "Add python.exe to PATH" during setup^)
    echo.
    echo After installing Python, run this file again.
    pause
    exit /b 1
)

echo Starting local server...
start "overlay-local-server" /min python -m http.server 8080

timeout /t 1 /nobreak >nul

start "" "http://localhost:8080/cyberpunk-gaming.html"
start "" "http://localhost:8080/cyberpunk-gaming.html"

echo.
echo Server started.
echo   Open this same URL in two tabs (editor + preview):
echo   http://localhost:8080/cyberpunk-gaming.html
echo.
echo Use the menu item "hyoji koushin" (display update) in one tab
echo to push changes to the other tab in real time.
echo.
echo Press any key in this window to stop the server.
pause >nul

taskkill /fi "WindowTitle eq overlay-local-server*" /f >nul 2>&1
echo Server stopped.
timeout /t 2 /nobreak >nul
