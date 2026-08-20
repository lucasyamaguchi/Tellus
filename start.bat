@echo off
title Tellus - Multi-Provider AI Hub
chcp 65001 > nul

echo.
echo   Inicializando Tellus (Desktop App + ai-memory)
echo   ============================================

cd /d "%~dp0"

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [ERRO] Node.js nao encontrado! Instale em https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo   Instalando dependencias pela primeira vez...
    call npm install
)

if not exist "server\node_modules" (
    echo   Instalando dependencias do servidor...
    cd server && call npm install && cd ..
)

if not exist "client\node_modules" (
    echo   Instalando dependencias do cliente...
    cd client && call npm install && cd ..
)

echo.
echo Abrindo Tellus Desktop...
start /min "" wscript.exe "%~dp0Tellus.vbs"
