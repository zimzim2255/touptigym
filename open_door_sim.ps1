# ============================================================
# SIMULATE "door open" exactly like relay.js's zkOpenDoor()
# Run on the gym PC (ZKBio at localhost:8098)
# Opens the physical door for anyone the moment it's run.
# ============================================================

$ErrorActionPreference = "Stop"

# Allow self-signed ZKBio cert
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

$base = "https://localhost:8098"

# --- Credentials + door (from the captured request + relay.js) ---
$rtLoginPwd    = "Admin123"
$loginMd5      = "e8b78fc1c91bc2cdc7dc2ad8ec59e0"   # MD5($rtLoginPwd)
$openInterval  = "2"
$ids           = "4028814aa024f57a01a700b66e0a33" # "All Doors" id
$names         = "All Doors"
$browserToken  = "0b45e7ef18f61df2237db91b10fd447"
$zkUser        = "admin"

# Cookie-aware session
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Mirrors relay.js zkLogin(): POST /login.do with username + MD5 password
function Invoke-Login {
  $body = "username=$user&password=$loginMd5"
  $headers = @{ "browser-token" = $browserToken }
  $r = Invoke-WebRequest -Uri "$base/login.do" -Method Post -Body $body `
      -ContentType "application/x-www-form-urlencoded" -Headers $headers `
      -WebSession $session
  Write-Host "LOGIN -> HTTP $($r.StatusCode)"
}

function Invoke-OpenDoor {
  $url = "$base/accRTMonitor.do?openDoor&name=All%20Doors"
  $body = "levelLoginPwd=$([uri]::EscapeDataString($rtLoginPwd))" +
          "&loginPwd=$([uri]::EscapeDataString($loginMd5))" +
          "&openInterval=$openInterval" +
          "&ids=$([uri]::EscapeDataString($ids))" +
          "&names=$([uri]::EscapeDataString($names))" +
          "&browserToken=$browserToken"
  $r = Invoke-WebRequest -Uri $url -Method Post -Body $body `
      -ContentType "application/x-www-form-urlencoded" `
      -WebSession $session -SkipHttpErrorCheck
  return $r
}

# 1) login
Invoke-Login
Write-Host "Login done"

# 2) open door
try {
  $res = Invoke-OpenDoor
  Write-Host "OPEN DOOR -> HTTP $($res.StatusCode)  body=$($res.Content)"
  if ("$($res.StatusCode)" -eq "200") { Write-Host "✅ DOOR OPENED (simulated relay)" }
  else {
    # 302 = session redirected: re-login + retry once (like relay.js)
    Write-Host "Got $($res.StatusCode) (302-ish). Re-login and retry..."
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    Invoke-Login
    $res2 = Invoke-OpenDoor
    Write-Host "RETRY -> HTTP $($res2.StatusCode)  body=$($res2.Content)"
    if ("$($res2.StatusCode)" -eq "200") { Write-Host "✅ DOOR OPENED (retry)" }
  }
} catch {
  Write-Host "FAILED: $($_.Exception.Message)"
}