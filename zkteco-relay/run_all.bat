@echo off
REM ============================================================
REM  run_all.bat — starts BOTH the ZKTeco relay AND the
REM  access-sync writer, each in its own hidden window, logging
REM  to relay_log.txt and access_sync_log.txt.
REM  Used by auto-start on boot/logon (install_autostart.ps1).
REM ============================================================
cd /d "%~dp0"
title ZKTeco Relay + AccessSync

echo Starting ZKTeco relay...
start "ZKTeco-Relay" /min cmd /c "node relay.js >> relay_log.txt 2>&1"

echo Starting access-sync (every 120s)...
start "ZKTeco-AccessSync" /min cmd /c "node access_sync.js --interval 120000 >> access_sync_log.txt 2>&1"

echo Both started. See relay_log.txt / access_sync_log.txt