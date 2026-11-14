@echo off
title Ase Alaketu Ile Iforiti - PWA Recepção
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 8080); $c.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "" /B powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0servidor-pwa.ps1"
  ping -n 2 127.0.0.1 >nul
)
start "" "http://localhost:8080"
