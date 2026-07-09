@echo off
cd /d "%~dp0"
title Overlay Local Server

echo Starting local server...
start "overlay-local-server" /min python -m http.server 8080

timeout /t 1 /nobreak >nul

start "" "http://localhost:8080/citypop.html"
start "" "http://localhost:8080/citypop.html"

echo.
echo Server started.
echo   Open this same URL in two tabs (editor + preview):
echo   http://localhost:8080/citypop.html
echo.
echo Use the menu item "hyoji koushin" (display update) in one tab
echo to push changes to the other tab in real time.
echo.
echo Press any key in this window to stop the server.
pause >nul

taskkill /fi "WindowTitle eq overlay-local-server*" /f >nul 2>&1
echo Server stopped.
timeout /t 2 /nobreak >nul
