# ZKTeco SpeedFace-V5L → Supabase Integration — Complete Setup Guide

> **Status: WORKING & PROVEN** — This is the exact procedure used to connect a ZKTeco SpeedFace-V5L-RFID to Supabase via a local relay on a Windows PC.

---

## 1. Architecture Overview

```
ZKTeco SpeedFace-V5L (192.168.1.201)
        │  polls /iclock/* (HTTP)
        ▼
Windows Relay PC (192.168.1.11:8090)  ← PowerShell HttpListener
        │  forwards to
        ▼
Supabase Edge Function
  /functions/v1/iclock/iclock/*  (registry, getrequest, cdata, devicecmd)
        │
        ▼
Supabase Database (zkteco_devices, zkteco_logs, zkteco_commands)
```

**Why a relay is needed:** The ZKTeco device calls `/iclock/*` at the **root** of the server address. Supabase only serves Edge Functions under `/functions/v1/...` — everything else returns 404. The relay translates the device's root paths to the Supabase function path.

---

## 2. Prerequisites

- A **Windows PC** on the **same network** as the ZKTeco device (the old ZKTime server PC works perfectly)
- The ZKTeco device's **IP** (e.g. 192.168.1.201) and **serial number** (e.g. NCK2243300188)
- A **Supabase project** with the `iclock` and `zkteco` Edge Functions deployed
- **Admin access** on the Windows PC (for firewall + hosts file)

---

## 3. Backend Setup (Supabase) — do ONCE per project

### 3.1 Deploy the Edge Functions

From the project root, deploy both functions:

```bash
cd supabase
npx supabase functions deploy iclock --project-ref <YOUR_PROJECT_REF> --no-verify-jwt
npx supabase functions deploy zkteco --project-ref <YOUR_PROJECT_REF> --no-verify-jwt
```

> Replace `<YOUR_PROJECT_REF>` with your Supabase project ref (e.g. `lpjdpcguplkpdfgxomps`).

### 3.2 Verify the functions respond

```bash
# Should return "OK"
curl "https://<PROJECT_REF>.supabase.co/functions/v1/iclock/iclock/registry?SN=TEST&model=SpeedFace-V5L"

# Should return [] (empty device list)
curl "https://<PROJECT_REF>.supabase.co/functions/v1/zkteco/devices"
```

### 3.3 Important: the routing fix

The functions use **robust path parsing** — they find the last `iclock`/`zkteco` segment in the URL and take everything after it. This handles the fact that Supabase strips `/functions/v1` before the code runs. **Do not remove this logic.**

---

## 4. Windows Relay PC Setup — do per location

### 4.1 Find the PC's IP

```cmd
ipconfig
```
Note the IPv4 address (e.g. `192.168.1.11`). This is the address the device will point to.

### 4.2 Add the Windows Firewall rule (Admin PowerShell)

```powershell
netsh advfirewall firewall add rule name="ZK RELAY 8090" dir=in action=allow protocol=TCP localport=8090
```

### 4.3 Fix DNS (bypass broken DNS on the PC)

The PC must resolve the Supabase domain. Add a hosts entry (Admin PowerShell):

```powershell
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "`n104.18.38.10 <PROJECT_REF>.supabase.co" -Force
ipconfig /flushdns
```

> Replace `<PROJECT_REF>` with your project ref. Verify with `ping <PROJECT_REF>.supabase.co` — should reply from 104.18.38.10.

### 4.4 Run the Relay (Admin PowerShell)

Paste this **entire block** — it listens on port 8090, logs the client IP, answers root health-checks locally, and forwards everything else to Supabase:

```powershell
$Target = "https://<PROJECT_REF>.supabase.co/functions/v1/iclock/iclock"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://192.168.1.11:8090/")
$listener.Start()
Write-Host "[RELAY] Listening on 192.168.1.11:8090/ (logs client IP)" -ForegroundColor Green
while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $client = $req.RemoteEndPoint.Address
    $path = $req.Url.AbsolutePath
    $query = $req.Url.Query
    Write-Host ("[RELAY] FROM " + $client + " " + $req.HttpMethod + " " + $path + $query) -ForegroundColor Yellow
    $bodyText = ""
    if ($req.HasEntityBody) {
      $reader = New-Object System.IO.StreamReader($req.InputStream)
      $bodyText = $reader.ReadToEnd()
      $reader.Close()
    }
    if ($path -eq "/") {
      $ok = [System.Text.Encoding]::UTF8.GetBytes("OK")
      $ctx.Response.StatusCode = 200
      $ctx.Response.ContentType = "text/plain"
      $ctx.Response.OutputStream.Write($ok, 0, $ok.Length)
      Write-Host "[RELAY] Root check -> OK (local)" -ForegroundColor Cyan
    } else {
      $forward = $Target + $path + $query
      $params = @{ Uri = $forward; UseBasicParsing = $true; TimeoutSec = 30 }
      if ($req.HttpMethod -eq "POST") {
        $params.Method = "POST"; $params.Body = $bodyText
        if ($req.ContentType) { $params.ContentType = $req.ContentType }
      } else {
        $params.Method = "GET"
      }
      $remote = Invoke-WebRequest @params
      $ctx.Response.StatusCode = 200
      if ($remote.Headers["Content-Type"]) { $ctx.Response.ContentType = $remote.Headers["Content-Type"] }
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($remote.Content)
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host ("[RELAY] -> " + $remote.StatusCode) -ForegroundColor Cyan
    }
  } catch {
    $ctx.Response.StatusCode = 502
    $err = "[RELAY ERROR] " + $_.Exception.Message
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($err)
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    Write-Host $err -ForegroundColor Red
  } finally {
    try { $ctx.Response.Close() } catch {}
  }
}
```

> **Replace** `192.168.1.11` with the PC's actual IP, and `<PROJECT_REF>` with your project ref.
> **Keep this window open 24/7** — the relay must run for the device to work.

### 4.5 Test the relay (new cmd window, keep relay open)

```cmd
curl http://192.168.1.11:8090/iclock/registry?SN=TEST-RELAY&model=SpeedFace-V5L
```
Should return **OK** and you'll see `[RELAY] FROM 192.168.1.11 GET /iclock/registry...` in the relay window.

---

## 5. Device Configuration

### 5.1 Access the device web UI

Open a browser on the relay PC → `http://<DEVICE_IP>` (e.g. `http://192.168.1.201`). Log in (default after factory reset: `admin` / `admin`).

### 5.2 Switch to Cloud/ADMS mode (CRITICAL)

On the device web UI or touchscreen:
- **Communication → Communication Mode** (or "Connection Mode")
- Change from **SDK/PC** to **Cloud** or **ADMS**
- Save

> **This is the step that makes the device actually poll the relay.** Without it, the device stays in SDK mode talking to the old ZKTime software and never reaches the relay.

### 5.3 Set the Register Server

On the **Register Server** screen (Communication → Register Server / Serveur d'enregistrement):

| Field | Set to |
|-------|--------|
| Register Server Mode | ADMS |
| Enable Domain Name | **OFF** (using IP) |
| Server Address | `192.168.1.11` (the relay PC's IP) |
| Server Port | **8090** |
| Enable Proxy | OFF |

Save / Apply.

### 5.4 Reboot the device

Many SpeedFace units only start cloud polling after a reboot. Reboot via touchscreen (Maintenance → Reboot) or power-cycle.

---

## 6. Verification

### 6.1 Confirm the device is polling the relay

In the relay window, you should see:
```
[RELAY] FROM 192.168.1.201 GET /iclock/getrequest?SN=NCK2243300188
[RELAY] -> 200
```
`FROM 192.168.1.201` = the physical device itself (not the PC). This is the definitive proof the device is live.

### 6.2 Confirm in the database

```bash
curl "https://<PROJECT_REF>.supabase.co/functions/v1/zkteco/devices"
```
The device should appear with its real serial number and `status: online`.

### 6.3 End-to-end door test (optional)

Queue a door-open command and pull it through the relay:

```bash
# Queue AC_UNLOCK for the device
curl "https://<PROJECT_REF>.supabase.co/functions/v1/iclock/iclock/devicecmd?SN=<DEVICE_SERIAL>&cmd=AC_UNLOCK"

# Pull it through the relay (should return AC_UNLOCK)
curl http://192.168.1.11:8090/iclock/getrequest?SN=<DEVICE_SERIAL>
```

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Relay shows `[RELAY ERROR] ... n'a pas pu être résolu` | PC DNS can't resolve Supabase | Add hosts entry (section 4.3) |
| Device never appears in relay log | Device still in SDK mode | Switch to Cloud/ADMS (section 5.2) + reboot |
| Relay won't start (port conflict) | Old relay or ZKTime holds the port | Use a different port (e.g. 8091) and update device + firewall |
| `FROM 192.168.1.11` (PC) instead of device IP | You're testing manually, not the device | Wait for the device's own poll cycle |
| Device registered but no logs | No face scans yet, or PINs not mapped to children | Enroll users; ensure children have `zkteco_id` set |

---

## 8. Notes for Replication

- **The relay PC must stay on 24/7.** For production, set the relay to auto-start on boot (Task Scheduler or a startup shortcut running the PowerShell script).
- **Each location needs its own relay PC** on the same network as its device(s).
- **The Supabase functions are shared** — deploy once, use from any location.
- **The device's serial number** is unique per device and is what identifies it in the database.
- **The hosts file entry** is per-PC and only needed if that PC's DNS fails to resolve the Supabase domain.