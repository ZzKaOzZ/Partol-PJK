@echo off
cd /d "%~dp0"
if exist "%~dp0.tools\node\npm.cmd" set "PATH=%~dp0.tools\node;%PATH%"
if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
)
echo Starting Partol at http://localhost:5173/
call npm run dev
