# ============================================================
#  run_access_sync.ps1  —  PowerShell wrapper that cd's safely
#  into the relay folder (handles spaces) then runs access_sync.
#
#  Usage:
#    powershell -ExecutionPolicy Bypass -File run_access_sync.ps1         (apply)
#    powershell -ExecutionPolicy Bypass -File run_access_sync.ps1 --dry-run
#    powershell -ExecutionPolicy Bypass -File run_access_sync.ps1 --interval 30000
# ============================================================
$here = (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $here

$scriptArgs = $args -join ' '
Write-Host "[ps1] running in: $here"
Write-Host "[ps1] node access_sync.js $scriptArgs"
node access_sync.js $args

Pop-Location
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }