@echo off
setlocal

cd /d "%~dp0"

start "Clothing Store Backend" cmd /k "cd /d backend && npm start"
start "Clothing Store Frontend" cmd /k "cd /d frontend && npm start"

endlocal
