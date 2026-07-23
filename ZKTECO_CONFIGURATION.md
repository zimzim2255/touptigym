# ZKTeco SpeedFace-V5L — Production Configuration Guide

> **Integration Method:** ZKTeco ADMS / iClock protocol (HTTP)
> **Backend:** Supabase Edge Functions (Deno/TypeScript) → PostgreSQL
> **ERP Frontend:** React (TouptiGym)

---

## Table of Contents

1. [PUSH vs Pull SDK — Choose Your Method](#1-push-vs-pull-sdk--choose-your-method)
2. [Network Settings (Device Touchscreen)](#2-network-settings-device-touchscreen)
3. [PUSH SDK Availability Check](#3-push-sdk-availability-check)
4. [PUSH SDK Settings (Device Touchscreen)](#4-push-sdk-settings-device-touchscreen)
5. [HTTP Endpoints Your Backend Must Implement](#5-http-endpoints-your-backend-must-implement)
6. [Time Synchronization](#6-time-synchronization)
7. [DNS Configuration](#7-dns-configuration)
8. [Firewall Configuration](#8-firewall-configuration)
9. [Connection Testing](#9-connection-testing)
10. [Network Architecture](#10-network-architecture)
11. [Backend Requirements](#11-backend-requirements)
12. [Security Checklist](#12-security-checklist)
13. [Full-Stack Architecture](#13-full-stack-architecture)
14. [Troubleshooting](#14-troubleshooting)
15. [CRITICAL: Domain Name vs IP Address](#15-critical-domain-name-vs-ip-address)
16. [Architecture Option A: Direct to Supabase (Domain Supported)](#16-architecture-option-a-direct-to-supabase-domain-supported)
17. [Architecture Option B: VPS Proxy (IP Only)](#17-architecture-option-b-vps-proxy-ip-only)

---

## 1. PUSH vs Pull SDK — Choose Your Method

Before configuring anything, decide which integration method you will use. They are **completely different** and affect the entire backend architecture.

| Feature | PUSH SDK (HTTP/iClock) | Pull SDK (Port 4370) |
|---------|----------------------|---------------------|
| **Protocol** | HTTP/HTTPS | TCP (proprietary) |
| **Port** | 80, 443, or 8080 | 4370 |
| **Device role** | Device sends data to server | Server requests data from device |
| **Real-time** | Yes (device pushes instantly) | No (server must poll) |
| **Backend complexity** | Medium | High (needs raw TCP) |
| **NAT/Firewall friendly** | Yes (outbound HTTP) | No (needs inbound TCP) |
| **Requires SDK enable** | Must be enabled on device | Usually always available |
| **Firmware requirement** | Some units need firmware upgrade | Generally supported |

**This guide assumes you are using PUSH SDK (HTTP/iClock protocol).**

---

## 2. Network Settings (Device Touchscreen)

Menu → **COMMUNICATION** → **NETWORK SETTINGS**

Use variables. Replace the values below with your actual network addresses:

| Parameter | Example Value | Your Value |
|-----------|---------------|------------|
| **DHCP** | **OFF** | ⬜ |
| **IP Address** | `192.168.1.100` | `<DEVICE_IP>` |
| **Subnet Mask** | `255.255.255.0` | `<SUBNET_MASK>` |
| **Gateway** | `192.168.1.1` | `<ROUTER_IP>` |
| **DNS Server** | leave blank (or router IP) | `<DNS_IP>` |

> **⚠️ CRITICAL:** The device MUST have a **STATIC IP**. If DHCP is used, the IP can change on restart and the connection to the server will be lost.

**Example (Morocco local network):**

```
Device IP : 192.168.1.100
Server IP : 192.168.1.50
Gateway   : 192.168.1.1
```

---

## 3. PUSH SDK Availability Check

Many SpeedFace V5L units support **only Pull SDK** or **Standalone SDK** out of the box. PUSH SDK may require a firmware upgrade.

### How to verify:

```
MENU → COMMUNICATION → scroll down
```

If you see **"Push SDK Settings"** or **"Push SDK"**, the device supports PUSH mode.

If you **do NOT** see this option, the device cannot be configured with PUSH SDK. You have two options:

- **Option A:** Contact ZKTeco support or your distributor to request a firmware upgrade that enables PUSH SDK
- **Option B:** Switch to Pull SDK (port 4370) integration

---

## 4. PUSH SDK Settings (Device Touchscreen)

Menu → **COMMUNICATION** → **PUSH SDK SETTINGS**

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Enable PUSH SDK** | **ON** | Mandatory |
| **Server IP** | `<BACKEND_IP>` | IP of your backend server |
| **Server Port** | `80` (HTTP) or `443` (HTTPS) | Must match your backend |
| **Communication Password** | leave blank or set | Must match backend if set |
| **Upload Interval** | `30` seconds | How often to send data |
| **Realtime Upload** | **ON** | Send data immediately when available |

> **Note on Server IP:** If your backend is on the same LAN, use the private IP (e.g., `192.168.1.50`). If the backend is on the internet, use a **public IP** or **domain name** (e.g., `https://attendance.yourcompany.com`).

---

## 5. HTTP Endpoints Your Backend Must Implement

The ZKTeco PUSH protocol requires these endpoints. Your backend **must** implement all of them.

### Required Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/iclock/cdata` | **POST** | Receives attendance logs from device |
| `/iclock/getrequest` | **GET** | Device polls for pending commands |
| `/iclock/devicecmd` | **GET** | Sends commands back to device |
| `/iclock/registry` | **GET** | Device registration |

### How the protocol works

```
Device pushes attendance:
  POST http://<BACKEND_IP>/iclock/cdata
  Body: tab-separated attendance records

Device checks for commands:
  GET http://<BACKEND_IP>/iclock/getrequest
  Response: command text or empty

Server sends command:
  GET http://<BACKEND_IP>/iclock/devicecmd?SN=<serial>&cmd=<command>

Device registers:
  GET http://<BACKEND_IP>/iclock/registry?SN=<serial>&model=<model>
```

### Example URL

```
POST http://192.168.1.50/iclock/cdata
```

or with domain:

```
POST https://attendance.mygym.com/iclock/cdata
```

---

## 6. Time Synchronization

Menu → **SYSTEM** → **TIME SETTINGS**

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Time Zone** | `Africa/Casablanca` or `UTC+1` | Use `Africa/Casablanca` if firmware supports it, otherwise `UTC+1` |
| **NTP Server** | `pool.ntp.org` | For automatic time sync |
| **Daylight Saving** | Disabled | Morocco does not observe DST |

> **⚠️ Morocco timezone note:** Morocco uses UTC+1 year-round. Some firmware versions support `Africa/Casablanca` as a named timezone. If yours does not, use `UTC+1`.

---

## 7. DNS Configuration

DNS is **not mandatory** for a local LAN setup.

| Scenario | DNS Setting |
|----------|-------------|
| **Local LAN only** | Leave blank OR set to router IP (`192.168.1.1`) |
| **Device needs internet** | `8.8.8.8` (Google DNS) or your ISP's DNS |
| **Using domain name for backend** | Must have a working DNS server |

---

## 8. Firewall Configuration

This is a common source of connection failures.

### Windows Firewall (if backend is on Windows)

```
Windows Defender Firewall
  → Advanced Settings
    → Inbound Rules
      → New Rule → Port → TCP
        → Allow TCP 80 (HTTP)
        → Allow TCP 443 (HTTPS)
        → Allow TCP 8080 (alternative HTTP)
```

### Linux / Ubuntu (UFW)

```bash
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8080/tcp  # Alternative HTTP
sudo ufw reload
```

### Cloud Server (AWS / GCP / Azure)

- Open port **80** or **443** in the **Security Group** / **Firewall Rules**
- Restrict source to the device subnet if possible (e.g., `192.168.1.0/24`)

### Why this matters

Without a firewall rule, the device's HTTP connection will be **silently dropped** — it will show "Connected" but the backend never receives data.

---

## 9. Connection Testing

Before configuring PUSH SDK, verify basic connectivity:

### Step 1: Ping the device

```bash
ping 192.168.1.100
```
→ Should get replies. If not, check cables and VLAN configuration.

### Step 2: Web interface

```bash
http://192.168.1.100
```
→ Open in a browser. If the device's web interface appears, networking is working.

### Step 3: SDK port test

**For PUSH SDK (HTTP):**
```bash
curl -v http://192.168.1.100/
```
→ Should return an HTTP response (device web server).

**For Pull SDK (port 4370):**
```bash
telnet 192.168.1.100 4370
```
or
```bash
nc -zv 192.168.1.100 4370
```
→ Connection should succeed. If connection is refused, Pull SDK may not be available.

---

## 10. Network Architecture

### Local LAN Setup (Recommended for initial setup)

```
                    LOCAL NETWORK (LAN)
                    ┌──────────────────┐
                    │                  │
    ┌───────────────┤  INTERNET ROUTER ├──────────────┐
    │               │                  │              │
    │               │  192.168.1.1     │              │
    │               └──────────────────┘              │
    │                      │                          │
    ▼                      ▼                          ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│  ZKTeco      │   │  Backend     │   │  Computer        │
│  SpeedFace   │   │  Server      │   │  (Browser)       │
│  -V5L        │   │              │   │                  │
│              │   │              │   │                  │
│  IP: .100    │   │  IP: .50     │   │  IP: .10         │
│  Mask:       │   │  Mask:       │   │  Mask:           │
│  255.255.255.0│   │  255.255.255.0│   │  255.255.255.0 │
│  Gateway:    │   │  Gateway:    │   │  Gateway:        │
│  192.168.1.1 │   │  192.168.1.1 │   │  192.168.1.1    │
└──────────────┘   └──────────────┘   └──────────────────┘
```

### Internet / Cloud Setup

```
                    ┌──────────────────┐
                    │   Internet       │
                    │                  │
                    │  43.xxx.xxx.xxx  │
                    └──────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │   Nginx Proxy    │
                    │   (Reverse Proxy)│
                    │   HTTPS (443)    │
                    └──────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │   Supabase       │
                    │   Edge Functions │
                    │   + PostgreSQL   │
                    └──────────────────┘
```

**When using internet:**

- Do **NOT** use `192.168.x.x` addresses — the device cannot reach private LAN IPs from outside
- Use `https://attendance.yourcompany.com` or a public IP like `41.xxx.xxx.xxx`
- Ensure ports 80/443 are open and forwarded to your backend

---

## 11. Backend Requirements

Your backend must meet these requirements for PUSH SDK to work:

| Requirement | Details |
|-------------|---------|
| ✓ **Public HTTP server** | Accessible by the device over HTTP/HTTPS |
| ✓ **Static IP or domain** | So the device always knows where to send data |
| ✓ **Supports ZKTeco PUSH SDK protocol** | Implements `/iclock/cdata`, `/iclock/getrequest`, `/iclock/devicecmd`, `/iclock/registry` |
| ✓ **Responds within a few seconds** | Slow responses cause device timeouts |
| ✓ **Stores attendance logs** | Persists data to database (PostgreSQL) |
| ✓ **Sends commands back to device** | Can queue commands for device to pick up |
| ✓ **Logs errors and debugging info** | For troubleshooting connection issues |

### Current Backend Implementation (TouptiGym)

The TouptiGym backend implements PUSH SDK via Supabase Edge Functions at:

```
https://<your-project>.supabase.co/functions/v1/zkteco/
```

Exposed endpoints:

```
POST /functions/v1/zkteco/iclock/cdata        → Receive attendance logs
GET  /functions/v1/zkteco/iclock/getrequest    → Device polls for commands
GET  /functions/v1/zkteco/iclock/devicecmd     → Send commands to device
GET  /functions/v1/zkteco/iclock/registry      → Device registration
```

---

## 12. Security Checklist

| Item | Status |
|------|--------|
| ✓ Communication password set on device | ⬜ |
| ✓ HTTPS enabled (reverse proxy with Nginx/Caddy) | ⬜ |
| ✓ Reverse proxy configured (Nginx, Caddy, Traefik) | ⬜ |
| ✓ Static IP for device and server | ⬜ |
| ✓ Strong admin password on device (not default `12345`) | ⬜ |
| ✓ Device password configured | ⬜ |
| ✓ Firewall rules applied (ports 80/443 restricted if possible) | ⬜ |
| ✓ Backend authentication for command endpoints | ⬜ |

> **⚠️ Default passwords:** The SpeedFace-V5L default admin password is `12345` or `0`. **Change it immediately.** An attacker on your network could reconfigure the device.

---

## 13. Full-Stack Architecture

```
┌──────────────────────────────────────────────────────┐
│                    LAN / Internet                     │
└──────────────────────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
┌──────────────────────┐  ┌──────────────────────┐
│   SpeedFace V5L      │  │   React ERP          │
│   (Device)           │  │   (TouptiGym UI)     │
│                      │  │                      │
│   Fingerprint/Face   │  │   Attendance views   │
│   → attendance log   │  │   Device management  │
│                      │  │   User admin panel   │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           │ HTTP PUSH               │ REST API
           ▼                         ▼
┌──────────────────────────────────────────────────────┐
│              Supabase Edge Functions                  │
│                                                       │
│   POST /iclock/cdata       ← receives attendance     │
│   GET  /iclock/getrequest  → device polls commands   │
│   GET  /iclock/devicecmd   → sends commands          │
│   GET  /iclock/registry    → device registration     │
│                                                       │
│   Device status tracking  →  zkteco_devices table    │
│   Attendance logging      →  zkteco_logs table       │
│   Command queuing         →  zkteco_commands table   │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                    PostgreSQL                         │
│                                                       │
│   zkteco_logs      ─── child_id → children           │
│   zkteco_devices   ─── device information            │
│   zkteco_commands  ─── pending commands for devices  │
│   children         ─── zkteco_id mapping             │
│   subscriptions    ─── active subscription validation│
│   access_logs      ─── granted/denied access         │
└──────────────────────────────────────────────────────┘
```

---

## 14. Troubleshooting

### Problem: Device shows "Connected" but no data arrives

- Check firewall rules (see section 8)
- Verify the backend port is open: `telnet <BACKEND_IP> <PORT>`
- Check if Nginx/Apache is blocking the path `/iclock/`
- Test with `curl -X POST http://<BACKEND>/iclock/cdata -d "test"`

### Problem: Cannot find PUSH SDK menu

- The device may not support PUSH SDK (see section 3)
- Try firmware update from ZKTeco distributor
- Consider using Pull SDK (port 4370) instead

### Problem: Device rejects server IP

- Verify the server IP is reachable from the device: ping from computer on same subnet
- Check if VLAN segregation is blocking traffic
- Ensure device and server are on the **same subnet**

### Problem: Attendance records have wrong times

- Check timezone setting (section 6)
- Verify NTP server is reachable from device
- Check if `Africa/Casablanca` or `UTC+1` is set correctly

### Problem: Device cannot reach internet-based server

- Check DNS settings (section 7)
- Verify port forwarding on router
- Ensure the server's security group/firewall allows the device IP

---

## 15. CRITICAL: Domain Name vs IP Address

**This is the most important decision for your architecture.**

The SpeedFace-V5L firmware varies between units. Some firmware versions allow entering a **domain name** (e.g., `your-project.supabase.co`) as the server address. Others only accept a **numeric IP address**.

### Scenario A: Device accepts domain names ✅ (Simpler)

If the device's **Cloud Server / ADMS Settings** screen lets you type letters, dots, and hyphens (like a web address), then you can point it **directly to Supabase**.

```
Server Address: your-project.supabase.co
Port: 443
```

### Scenario B: Device only accepts IP addresses ❌ (Needs a VPS)

If the device screen only shows a numeric keypad (digits and dots), it **only accepts an IP address**. You cannot point it directly to Supabase because:

- Supabase does not provide a static IP
- Supabase IPs are shared and can change
- The device cannot resolve `*.supabase.co` to an IP directly in this field

**Solution:** You need a small VPS with a static IP to act as a proxy.

---

## 16. Architecture Option A: Direct to Supabase (Domain Supported)

If your device firmware accepts domain names:

```text
          SpeedFace V5L
               │
     ┌─────────┴─────────┐
     │   Device Setting   │
     │  Server: x.supabase.co │
     │  Port: 443         │
     └─────────┬─────────┘
               │ HTTPS POST /functions/v1/iclock/iclock/cdata
               ▼
    ┌──────────────────────────┐
    │ Supabase Edge Function   │
    │ /functions/v1/iclock     │
    │                          │
    │ Parses url-encoded       │
    │ or plain text            │
    │ Responds with "OK"       │
    └────────────┬─────────────┘
                 │
                 ▼
    ┌──────────────────────────┐
    │ PostgreSQL               │
    │ zkteco_logs              │
    │ access_logs              │
    │ zkteco_devices           │
    └──────────────────────────┘
```

### Device Configuration

| Setting | Value |
|---------|-------|
| **Server Type** | ADMS / Cloud Server |
| **Server Address** | `your-project.supabase.co` |
| **Port** | `443` |
| **Path** | `/functions/v1/iclock` |

### Full URL the device will call

```
https://your-project.supabase.co/functions/v1/iclock/iclock/cdata
```

---

## 17. Architecture Option B: VPS Proxy (IP Only)

If your device firmware **only accepts numeric IP addresses**, you need a small VPS with a static IP to forward requests to Supabase.

```text
          SpeedFace V5L
               │
     ┌─────────┴─────────┐
     │   Device Setting   │
     │  Server: 41.xxx.xxx.xxx │
     │  Port: 80 or 443   │
     └─────────┬─────────┘
               │ HTTP POST /iclock/cdata
               ▼
    ┌──────────────────────────────┐
    │ VPS (Static IP)              │
    │ Nginx / Caddy Reverse Proxy  │
    │                              │
    │ /iclock/* → supabase.co      │
    └────────────┬─────────────────┘
                 │ Proxy to Supabase
                 ▼
    ┌──────────────────────────────┐
    │ Supabase Edge Function       │
    │ /functions/v1/iclock         │
    └──────────────────────────────┘
```

### Nginx Configuration (on the VPS)

```nginx
server {
    listen 80;
    server_name _;

    location /iclock/ {
        proxy_pass https://your-project.supabase.co/functions/v1/iclock/;
        proxy_set_header Host your-project.supabase.co;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_method POST;
    }
}
```

### Device Configuration

| Setting | Value |
|---------|-------|
| **Server Type** | ADMS / Cloud Server |
| **Server IP** | `41.xxx.xxx.xxx` (your VPS static IP) |
| **Port** | `80` |
| **Path** | `/iclock` |

### Full URL the device will call

```
http://41.xxx.xxx.xxx/iclock/cdata
```

---

## Appendix: Step-by-Step Quick Start

1. **Check device firmware** — Can it accept a domain name or only an IP? (section 15)
2. **Verify PUSH SDK availability** on device (section 3)
3. **Set static IP** on device (section 2)
4. **Ping and test** connectivity (section 9)
5. **Open firewall ports** on server (section 8)
6. **Configure ADMS/PUSH SDK** on device (section 4, 16 or 17)
7. **Deploy backend**:
   ```bash
   cd supabase
   supabase functions deploy iclock
   ```
8. **Set timezone** correctly (section 6)
9. **Add security** measures (section 12)
10. **Test with real attendance** — tap finger/fingerprint and check logs in TouptiGym → Accès ZKTeco
