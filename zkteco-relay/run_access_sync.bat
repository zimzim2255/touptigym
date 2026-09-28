@echo off
rem ============================================================
rem  run_access_sync.bat  —  fire-and-forget launcher for the
rem  Casa access-sync writer. Works no matter where this file is
rem  and how many spaces are in the path (uses %~dp0 = this folder).
rem
rem  Usage (from ANY folder):
rem    run_access_sync.bat          -> apply once
rem    run_access_sync.bat dry      -> dry-run (no writes)
rem    run_access_sync.bat loop 30  -> run every 30s (service-like)
rem ============================================================
setlocal
cd /d "%~dp0"

set ARG1=%~1
set ARG2=%~2

if /i "%ARG1%"=="dry" (
  echo [bat] dry-run mode (no writes)
  node access_sync.js --dry-run
  goto :done
)

if /i "%ARG1%"=="loop" (
  echo [bat] interval mode, every %ARG2%s
  node access_sync.js --interval %ARG2%000
  goto :done
)

echo [bat] apply once
node access_sync.js

:done
echo.
pause