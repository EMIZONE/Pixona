@echo off
rem  PIXONA - lanzador del servidor de desarrollo.
rem  Doble clic sobre este archivo para jugar.

setlocal
cd /d "%~dp0"

echo.
echo   PIXONA // iniciando servidor local...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Open
if errorlevel 1 (
  echo.
  echo   El servidor termino con error. Revisa el mensaje de arriba.
  pause
)

endlocal
