@echo off
title Starting TeamTime HR System...
echo ==============================================================
echo Starting TeamTime HR System (Backend, Frontend, and Database)
echo ==============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1"
pause
