# ZKTeco SpeedFace-V5L — Device Setup Guide (Simple)

> Use this guide to configure the physical device so it talks to TouptiGym
> and follows unlock orders from the app.

---

## 1. What the device will do

```
Child scans face
      │
      ▼
Device finds the child's PIN (local face recognition)
      │
      ▼
Device sends the attendance to TouptiGym:
  POST https://your-project.supabase.co/functions/v1/iclock/iclock/cdata
      │
      ▼
TouptiGym checks:
  1. Is the PIN linked to a child?      (children.zkteco_id)
  2. Does the child have a valid subscription?  (status = 'actif')
  3. Is the child allowed at this time? (access_schedules)
      │
      ├── ALL GRANTED → Queues AC_UNLOCK command
      │
      ▼
Device polls for commands:
  GET https://your-project.supabase.co/functions/v1/iclock/iclock/getrequest?SN=xxxx
      │
      ▼
Device receives AC_UNLOCK → door opens
```

---

## 2. Before you start

- [ ] Your Supabase project is deployed (run `deploy.ps1`)
- [ ] The SQL migration `supabase/migration_add_zkteco_missing_tables.sql`
      has been run in the Supabase SQL editor
- [ ] You know if your device accepts a **domain name** or **only an IP**.
      If only an IP → you need a VPS proxy (see section 6)

---

## 3. Configure the device (touchscreen)

### 3.1 Network settings
```
Menu → COMMUNICATION → NETWORK SETTINGS

DHCP        : OFF
IP Address  : 192.168.x.x   (static, pick one)
Subnet Mask : 255.255.255.0
Gateway     : 192.168.x.1   (your router)
```

> ⚠️ The device MUST have a static IP.

### 3.2 Enable PUSH SDK
```
Menu → COMMUNICATION → PUSH SDK SETTINGS

Enable PUSH SDK     : ON
Server Address      : your-project.supabase.co   (or your VPS IP)
Server Port         : 443                        (or 80)
Communication Pwd   : (leave blank for now)
Upload Interval     : 30 seconds
Realtime Upload     : ON
Path                : /functions/v1/iclock
```

> If you do NOT see "Push SDK Settings", the device firmware doesn't support
> PUSH mode. Contact ZKTeco for a firmware upgrade.

### 3.3 Time settings
```
Menu → SYSTEM → TIME SETTINGS

Time Zone : UTC+1 (or Africa/Casablanca if available)
NTP Server: pool.ntp.org
```

---

## 4. Link children to the device

1. Open the TouptiGym app → **Enfants** → **Ajouter / Modifier un enfant**
2. In the **ZKTeco ID** field, type the child's device PIN
   (the number the device uses for that user, e.g. `1001`)
3. Save.

> The PIN must match EXACTLY the user ID created on the device
> (Device → User Management → Add User → get the PIN).

---

## 5. Set access schedules (optional but recommended)

When a child has an active subscription, they can enter **anytime**.
To restrict entry to specific days/times:

1. Open the app → **Enfants** → select a child → **Planning Accès**
2. Add windows like: Monday 08:00 → 18:00
3. If a scan happens outside these windows → `denied_schedule`
   (no unlock).

---

## 6. If the device only accepts an IP address

The device cannot use `your-project.supabase.co` directly. Use a VPS proxy:

```
Device (IP: 41.xxx.xxx.xxx)  →  Nginx on VPS  →  Supabase Edge Function
```

Nginx config:
```nginx
server {
    listen 80;
    server_name _;

    location /iclock/ {
        proxy_pass https://your-project.supabase.co/functions/v1/iclock/;
        proxy_set_header Host your-project.supabase.co;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

Then set the device's **Server Address** to your VPS IP and **Port** to `80`.

---

## 7. Test the setup

1. Enroll a child on the device (face scan).
2. Check the app: **Accès ZKTeco** page.
   - The device should appear automatically (auto-registered via `/iclock/registry`).
3. Scan the child's face.
4. Check the app again:
   - A log entry appears (`granted` or `denied`).
   - If granted → the app queued `AC_UNLOCK` and the door should open
     within a few seconds (device polls every ~30s).

### Test with curl (from your computer, on the same network)

Simulate a face scan:
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/iclock/iclock/cdata?SN=TESTDEVICE123&table=ATTLOG&Stamp=999" \
  -H "apikey: YOUR_ANON_KEY" \
  -d "PIN=1001	TIME=2026-08-04 09:00:00	0	1"
```

You should see `OK`.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| Device shows "Connected" but no data | Check firewall ports 80/443 open |
| No unlock after granted scan | Verify the device SN is registered (`zkteco_devices`) — check Accès ZKTeco page |
| Wrong times in logs | Fix timezone (section 3.3) |
| PUSH SDK menu missing | Firmware doesn't support PUSH — request upgrade from ZKTeco |
| Device only accepts numbers in Server field | Use a VPS proxy (section 6) |

---

## 9. Endpoints your device uses (for reference)

| Endpoint | Method | Purpose |
|---|---|---|
| `/iclock/cdata` | POST | Device uploads attendance scans |
| `/iclock/getrequest` | GET | Device polls for commands (e.g. AC_UNLOCK) |
| `/iclock/devicecmd` | GET | Server queues commands for the device |
| `/iclock/registry` | GET | Device self-registers on first connect |

All under: `https://your-project.supabase.co/functions/v1/iclock`