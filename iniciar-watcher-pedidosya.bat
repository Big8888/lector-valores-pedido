@echo off
setlocal

cd /d "%~dp0"
title Watcher PedidosYa PDF

echo ==========================================
echo   Watcher de PedidosYa PDF
echo ==========================================
echo Carpeta del proyecto: %CD%
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro npm en este equipo.
  echo Instala Node.js y volve a intentar.
  echo.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] No se encontro package.json en esta carpeta.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] No existe node_modules. Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo npm install.
    echo.
    pause
    exit /b 1
  )
)

if "%PEDIDOSYA_PDF_WATCH_INTERVAL_MS%"=="" (
  set "PEDIDOSYA_PDF_WATCH_INTERVAL_MS=5000"
)

echo [INFO] Iniciando watcher...
echo [INFO] Intervalo: %PEDIDOSYA_PDF_WATCH_INTERVAL_MS% ms
echo [INFO] Para cerrar, usa Ctrl+C
echo.

call npm run pedidosya:pdf:watch
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo [INFO] El watcher termino con codigo %EXIT_CODE%.
echo.
pause
exit /b %EXIT_CODE%
