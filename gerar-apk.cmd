@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0gerar-apk.ps1"
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo [ERRO] A geracao do APK terminou com codigo %EXITCODE%.
  pause
)
exit /b %EXITCODE%
