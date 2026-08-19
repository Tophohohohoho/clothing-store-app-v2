@echo off
setlocal

cd /d "%~dp0"

start "SHOP LRU Backend" cmd /k "cd /d backend && npm start"
start "SHOP LRU Frontend" cmd /k "cd /d frontend && npm start"

endlocal
