# ============================================================
# Auto-start ZKTeco relay on Windows
# Run ONCE as Administrator:
#   powershell -ExecutionPolicy Bypass -File install_autostart.ps1
# Creates a scheduled task that starts the relay at LOGON.
# ============================================================

$path = Join-Path $PSScriptRoot "run_all.bat"
if (-not (Test-Path $path)) {
  Write-Host "run_all.bat not found: $path" -ForegroundColor Red
  exit 1
}

$taskName = "ZKTeco Relay"

# Remove old task if present
schtasks /Delete /TN $taskName /F 2>$null | Out-Null

# Create task that runs at logon (of any user), hidden window
schtasks /Create /TN $taskName /TR "`"$path`"" /SC ONLOGON /RL LIMITED /F

Write-Host ""
Write-Host "✅ Auto-start installed:" -ForegroundColor Green
Write-Host "   Task:  $taskName"
Write-Host "   Runs:  at logon -> $path   (ZKTeco relay + access-sync)"
Write-Host "   Logs:  $PSScriptRoot\relay_log.txt"
Write-Host "          $PSScriptRoot\access_sync_log.txt"
Write-Host ""
Write-Host "To test now, start it manually:" -ForegroundColor Cyan
Write-Host "   node `"$PSScriptRoot\relay.js`""
Write-Host "   node `"$PSScriptRoot\access_sync.js --interval 120000`""
Write-Host ""

# Optional: also register a startup shortcut (simpler alternative)
$startup = [Environment]::GetFolderPath('Startup')
$shortcut = Join-Path $startup "ZKTeco Relay.bat"
Copy-Item $path $shortcut -Force
Write-Host "Also added startup shortcut: $shortcut" -ForegroundColor Green