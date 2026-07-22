# ZKTeco SpeedFace-V5L Configuration Guide — Network & PUSH SDK Setup

## Settings to configure ON THE DEVICE (via the device's touchscreen menu)

### 1. Network Settings

Go to device menu → **COMMUNICATION** → **NETWORK SETTINGS**

| Parameter | Value | Explanation |
|-----------|-------|-------------|
| **IP Address** | `192.168.1.100` (example) | Static IP address for the device |
| **Subnet Mask** | `255.255.255.0` | Subnet mask |
| **Gateway** | `192.168.1.1` (example) | Gateway address (your router/internet box) |
| **DNS Server** | `8.8.8.8` or your network's DNS | DNS server (for domain name resolution) |
| **DHCP** | **OFF** | Use STATIC IP so the device always has the same address |

> **⚠️ Important:** The device MUST have a **STATIC IP**. If DHCP is used, the IP address can change on restart and the connection to the server will be lost.

### 2. PUSH SDK Settings

Menu → **COMMUNICATION** → **PUSH SDK SETTINGS**

| Parameter | Value | Explanation |
|-----------|-------|-------------|
| **Enable PUSH SDK** | **ON** | MANDATORY - without this the device won't communicate |
| **Server IP** | `192.168.1.50` (example) | IP address of your backend server |
| **Server Port** | `80` (HTTP) or `443` (HTTPS) | Port of your backend server |
| **Communication Password** | (leave blank if not set) | Password if required by your setup |
| **Upload Interval** | `30` seconds | How often to send data |
| **Realtime Upload** | **ON** | Send data immediately when available |

### 3. Time Synchronization Settings

Menu → **SYSTEM** → **TIME SETTINGS**

| Parameter | Value | Explanation |
|-----------|-------|-------------|
| **Time Zone** | `UTC+1` | Morocco (Casablanca) |
| **NTP Server** | `pool.ntp.org` | Automatic time synchronization |
| **Daylight Saving** | Disabled | Morocco does not observe DST |

### 4. Network Connection Diagram

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
│  255.255.255.0│   │  255.255.255.0│   │  255.255.255.0  │
│  Gateway:    │   │  Gateway:    │   │  Gateway:        │
│  192.168.1.1 │   │  192.168.1.1 │   │  192.168.1.1    │
└──────────────┘   └──────────────┘   └──────────────────┘
```

### 5. Step-by-Step Configuration (from device screen)

1. Power on the ZKTeco SpeedFace-V5L
2. Press the **MENU** button (or swipe down)
3. Enter admin password (default: `12345` or `0`)
4. Go to **COMMUNICATION**
5. Select **NETWORK SETTINGS**
6. Configure:
   - **DHCP** → OFF
   - **IP Address** → 192.168.1.100 (choose a free IP on your network)
   - **Subnet Mask** → 255.255.255.0
   - **Gateway** → 192.168.1.1 (your router's address)
   - **DNS** → 8.8.8.8
7. Save and reboot the device
8. Go back to **COMMUNICATION** → **PUSH SDK**
9. Enable **PUSH SDK** → ON
10. Enter the **backend Server IP** (e.g., 192.168.1.50)
11. Enter **Server Port** (80)
12. Save

### 6. Verify the Connection

On the device, go to **SYSTEM** → **ABOUT** → check if network status is **Connected**.

Or from any computer on the same network, open a browser and type:
```
http://192.168.1.100/
```
(replace with the device's IP) — if the device's web interface appears, the network is working.

### 7. Prerequisites Summary

| Item | Detail |
|------|--------|
| Ethernet cable or WiFi | Device must be connected to the network |
| Static IP on device | MANDATORY - so the server can always find it |
| Static IP on server | Recommended - so the device knows where to send data |
| Same local network | Simplest setup - no complex configuration needed |
| Port 80 open | If server is on a different network, open the port |
| PUSH SDK Enabled | MANDATORY on the device |
| Correct time | UTC+1 for Morocco |