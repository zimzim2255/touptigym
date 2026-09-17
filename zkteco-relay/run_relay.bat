@echo off
REM ZKTeco relay launcher — used by auto-start on boot/logon
cd /d "%~dp0"
title ZKTeco Relay
echo Starting ZKTeco relay...
node relay.js >> relay_log.txt 2>&1