# Specifications — "TOUP TI GYM" Management Application

## 1. General Overview

### 1.1. Description
Complete management application for a children's gym/sports center. It covers:
- Administrative management (children, parents, subscriptions, payments)
- Sports management (exercises, trainers, attendance)
- Physical access control via ZKTeco SpeedFace-V5L
- Automated attendance and absence tracking

### 1.2. Target Audience
- **Administrator** : Complete establishment management
- **Worker** : Daily operational management
- **Trainer/Coach** : Session tracking and attendance
- **Parent** : Child monitoring (consultation)

---

## 2. Application Modules and Pages

### 2.1. Role Selection Page
- Profile selection: Administrator / Worker / Trainer
- Demo mode for presentation

### 2.2. Admin Dashboard
Included pages:
1. **Children Management** — List + CRUD
2. **Parents Management** — List + CRUD
3. **Subscriptions Management** — Creation, tracking, confirmation
4. **Exercises Management** — Sports session creation
5. **Trainers Management** — CRUD with account creation
6. **Urgent Requests** — Approval/Rejection
7. **Absence Management** — Full history
8. **Checks Management** — Payment collection
9. **Users Management** — Account creation (admin, worker, trainer)
10. **Pricing & Settings** — Price configuration, discounts, schedules

### 2.3. Worker Dashboard
Included pages:
1. **Children Management**
2. **Parents Management**
3. **Create Subscriptions** (pending admin validation)
4. **Urgent Requests**

### 2.4. Trainer Dashboard
Included pages:
1. **My Today's Exercises** — List of scheduled sessions
2. **Mark Attendance** — Manual check-in for children
3. **Upcoming Exercises** — Forward planning
4. **Create Urgent Request**
5. **Create Exercise**
6. **View Attendance/Absences** for own sessions

### 2.5. Parent Portal (to be developed)
- View child information
- Attendance/absence history
- Subscription and payment history
- Notification in case of absence

---

## 3. Pricing Grid (EDITABLE)

### 3.1. Subscription Prices

| Activities | Session (24 weeks) | Year (48 weeks) |
|-----------|-------------------|----------------:|
| 1 activity/week | 3 900 Dhs | 6 600 Dhs |
| 2 activities/week | 6 300 Dhs | 10 200 Dhs |
| 3 activities/week | 8 100 Dhs | 13 800 Dhs |
| 4 activities/week | 9 300 Dhs | 16 200 Dhs |

### 3.2. Additional Fees
- **Registration fee** : 700 Dhs (editable)
- **Insurance and membership card** : 300 Dhs (editable)

### 3.3. Discounts
- **-10%** : Second child enrollment
- **-20%** : Third child enrollment
- **Custom discount** : Free discount option for special cases (birthday, loyalty, promotion)

### 3.4. Configuration
- All prices must be editable from the admin interface
- Discounts must be configurable (percentage and conditions)
- Ability to add/delete price lines
- Price modification history

---

## 4. ZKTeco SpeedFace-V5L Integration — Access Control

### 4.1. General Principle
The ZKTeco SpeedFace-V5L is a biometric reader (facial recognition) that works **online and offline**. The application must integrate with this device to manage access to the gym.

### 4.2. System Operation

#### A. Client (Child) Creation
1. When registering a child, the administrator enters a **Client ID** in the application
2. This ID is generated from the ZKTeco SpeedFace-V5L (the device creates a unique identifier for each registered face)
3. The ZKTeco ID is associated with the child's profile in the application
4. The administrator defines the **authorized access days and times** for this child (based on their subscription)

#### B. Access Hours
- Each child has **defined time slots** (e.g., Monday 2pm-4pm, Wednesday 10am-12pm)
- **Entry tolerance** :
  - Child can enter **15 minutes before** scheduled time
  - Child can enter **up to 30 minutes after** scheduled time
  - Example: Session at 12:00 → Authorized access from 11:45 to 12:30
- Outside this window, access is denied

#### C. Facial Scan Process
1. Child presents themselves to the ZKTeco SpeedFace-V5L
2. Device scans their face
3. Application queries ZKTeco to check if face matches an existing client ID in the database
4. If ID exists:
   - Check authorized day and time
   - If within tolerance window → **Access granted** (door unlocked)
   - If outside → **Access denied**
5. If ID doesn't exist → **Access denied**

#### D. Attendance and Absence Management
- If child **enters** the facility within their time window → Automatically **Marked "Present"**
- If child **does not show up** during their time window → Automatically **Marked "Absent"**
- If child enters but does not complete the full session → Marked "Early departure"
- Complete passage history (date, entry time, exit time)

#### E. Access Control Dashboard
- Real-time view of daily entries/exits
- Statistics: attendance rate, late arrivals, absences
- Alerts for denied access (intrusion attempt)
- Access report export

### 4.3. Offline Mode Management
- ZKTeco SpeedFace-V5L stores registered faces locally
- In offline mode, the device operates autonomously:
  - Facial scan possible without internet connection
  - Access logs stored locally on the device
  - Automatic log synchronization when connection is restored
- Application must maintain local cache of access schedules

### 4.4. Data Schema for Access Control
- **Table: zkteco_devices** — Device list (ID, name, IP address, status)
- **Table: access_schedules** — Access schedules (child_id, weekday, start_time, end_time)
- **Table: access_logs** — Passage history (child_id, device_id, timestamp, type: entry/exit, status: granted/denied)
- **Table: absences** — Recorded absences (child_id, session_id, date, type: abs/late, justified: yes/no)

### 4.5. Impact on Subscriptions
- When creating a subscription, access slots are automatically defined based on selected exercises
- Administrator can modify slots
- Active subscription = authorized access. Expired subscription = automatically blocked access

---

## 5. Payment Management

### 5.1. Accepted Payment Types
- **Cash** — Manual recording
- **Check** — Information entry (number, bank, amount, account holder)
- **Bank Transfer** — Transfer tracking

### 5.2. Check Tracking
- Recording: number, bank, account holder, amount, date
- Status: Available / Used
- Check scan/photo (optional)

### 5.3. Subscription Payment
- Possibility to pay in installments (max 2 payment methods)
- Registration fee charged once
- Insurance and membership card at each annual renewal

---

## 6. Database (SQL Tables)

### 6.1. Table: users
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| email | VARCHAR | Login email |
| name | VARCHAR | Full name |
| role | ENUM | admin / worker / trainer / parent |
| password | VARCHAR | Password hash |
| trainer_id | UUID | Trainer reference (if role trainer) |
| created_at | TIMESTAMP | Creation date |

### 6.2. Table: children
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| name | VARCHAR | Full name |
| gender | ENUM | Boy / Girl |
| birth_date | DATE | Date of birth |
| age | INT | Calculated age |
| school | VARCHAR | School name |
| school_type | VARCHAR | Bilingual / Mission / Other |
| address | TEXT | Address |
| postal_code | VARCHAR | Postal code |
| client_type | ENUM | Normal / VIP |
| zkteco_id | VARCHAR | ID generated by ZKTeco |
| photo | TEXT | Photo URL |
| created_at | TIMESTAMP | Creation date |

### 6.3. Table: parents
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| name | VARCHAR | Full name |
| phone | VARCHAR | Phone number |
| email | VARCHAR | Email |
| id_card | VARCHAR | National ID card |
| created_at | TIMESTAMP | Creation date |

### 6.4. Table: parent_children
| Field | Type | Description |
|-------|------|-------------|
| parent_id | UUID | Parent reference |
| child_id | UUID | Child reference |

### 6.5. Table: prices
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| type | VARCHAR | subscription / registration_fee / insurance |
| activities | INT | Number of activities/week |
| duration | VARCHAR | session / year |
| amount | DECIMAL | Price |
| editable | BOOLEAN | Can be modified from interface |

### 6.6. Table: discounts
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| name | VARCHAR | Label (e.g., "2nd child") |
| type | ENUM | percentage / fixed_amount |
| value | DECIMAL | Discount value |
| condition | TEXT | Application condition |
| active | BOOLEAN | Discount active or not |

### 6.7. Table: subscriptions
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| child_id | UUID | Child reference |
| type | VARCHAR | Monthly / Quarterly / Annual |
| sub_type | VARCHAR | Package (e.g., "1 ch / 2 Act") |
| amount | DECIMAL | Total amount |
| discount | DECIMAL | Applied reduction |
| insurance | DECIMAL | Insurance amount |
| entry_fee | DECIMAL | Registration fee |
| status | ENUM | active / pending / expired / cancelled |
| exercises | UUID[] | Included exercise list |
| start_date | DATE | Validity start |
| end_date | DATE | Validity end |
| created_by | UUID | Creator user |
| confirmed_by | UUID | Confirming admin |
| created_at | TIMESTAMP | Creation date |

### 6.8. Table: exercises
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| name | VARCHAR | Exercise name |
| day | VARCHAR | Day of week |
| type | VARCHAR | Football / Basketball / Swimming / Gymnastics / Other |
| start_date | DATE | Start date |
| end_date | DATE | End date |
| start_time | TIME | Start time |
| end_time | TIME | End time |
| coach_id | UUID | Trainer reference |
| price | DECIMAL | Session price |

### 6.9. Table: trainers
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| user_id | UUID | User account reference |
| name | VARCHAR | Full name |
| birth_date | DATE | Date of birth |
| id_card | VARCHAR | ID card |
| photo | TEXT | Photo URL |
| email | VARCHAR | Email |
| phone | VARCHAR | Phone number |
| specialty | VARCHAR | Sports specialty |
| created_at | TIMESTAMP | Creation date |

### 6.10. Table: payments
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| subscription_id | UUID | Subscription reference |
| amount | DECIMAL | Paid amount |
| method | VARCHAR[] | Cash / Check / Transfer |
| check_ids | UUID[] | Check references |
| created_at | TIMESTAMP | Payment date |

### 6.11. Table: checks
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| number | VARCHAR | Check number |
| amount | DECIMAL | Amount |
| bank | VARCHAR | Bank name |
| account_holder | VARCHAR | Account holder |
| used | BOOLEAN | Check used or not |
| payment_id | UUID | Payment reference |
| file | TEXT | Check scan/photo |
| created_at | TIMESTAMP | Creation date |

### 6.12. Table: zkteco_devices
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| name | VARCHAR | Device name |
| ip_address | VARCHAR | IP address |
| port | INT | Connection port |
| status | ENUM | online / offline / maintenance |
| location | VARCHAR | Physical location |
| last_log | TIMESTAMP | Last communication |

### 6.13. Table: access_schedules
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| child_id | UUID | Child reference |
| weekday | INT | 0=Sunday, 1=Monday... |
| start_time | TIME | Authorized start time |
| end_time | TIME | Authorized end time |
| window_before | INT | Minutes before (default: 15) |
| window_after | INT | Minutes after (default: 30) |

### 6.14. Table: access_logs
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| child_id | UUID | Child reference |
| device_id | UUID | ZKTeco device reference |
| timestamp | TIMESTAMP | Passage date and time |
| type | ENUM | entry / exit |
| status | ENUM | granted / denied / error |
| denial_reason | VARCHAR | Reason if denied |
| mode | ENUM | online / offline |

### 6.15. Table: absences
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| child_id | UUID | Child reference |
| exercise_id | UUID | Exercise/session reference |
| date | DATE | Absence date |
| type | ENUM | absence / late / early_departure |
| justified | BOOLEAN | Absence justified or not |
| justification | TEXT | Reason or document |
| created_at | TIMESTAMP | Recording date |

### 6.16. Table: urgent_requests
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier |
| child_id | UUID | Child reference |
| exercise_id | UUID | Exercise reference |
| date | DATE | Concerned date |
| notes | TEXT | Request description |
| status | ENUM | pending / approved / rejected |
| created_by | UUID | Request creator |
| created_at | TIMESTAMP | Creation date |

---

## 7. Key Features

### 7.1. Registration and Subscription
- Subscription type selection with dynamic pricing
- Automatic sibling discount application
- Customizable discount (fixed amount or percentage)
- ZKTeco access schedule integration within subscription
- Automatic access schedule generation based on selected exercises

### 7.2. Access Control
- Synchronization with ZKTeco SpeedFace-V5L
- Per-child time slot management
- Configurable entry tolerance (before/after)
- Offline mode with local cache
- All passage logs
- Attendance statistics

### 7.3. Attendance Management
- Automatic marking via ZKTeco
- Manual marking by trainer (for sessions)
- Automatic absence detection
- Complete history with filters
- Parent notifications in case of absence

### 7.4. Dashboard and Reports
- Dashboard with key indicators
- Attendance rate per child / per exercise
- Payment collection status
- Expired or pending subscription list
- Alerts and notifications

---

## 8. Technical Integration with ZKTeco SpeedFace-V5L (PUSH SDK)

### 8.1. Communication Protocol
The ZKTeco SpeedFace-V5L uses **PUSH SDK Protocol v2.0.1** — an HTTP-based protocol where the device initiates communication with the server.

### 8.2. Communication Architecture

```
┌─────────────────┐         HTTP/HTTPS          ┌──────────────────┐
│  ZKTeco          │ ◄─────────────────────────► │  Server          │
│  SpeedFace-V5L   │                             │  (Backend App)   │
│                  │                             │                  │
│  - Facial scan   │                             │  - REST API      │
│  - Local storage │                             │  - Database      │
│  - Offline cache │                             │  - Access logs   │
└─────────────────┘                             └──────────────────┘
         │                                                │
         │                                                │
         ▼                                                ▼
┌─────────────────┐                             ┌──────────────────┐
│  Local DB        │                             │  Database        │
│  (faces, logs)   │                             │  Supabase/Postgres│
└─────────────────┘                             └──────────────────┘
```

### 8.3. Communication Flow

#### Step 1: Initial Configuration
Device sends a GET request to the server to read its configuration:
```
GET /iclock/cdata?SN=XXXXXX&options=all&pushver=2.0.1&language=XX
```
Server responds with communication parameters (intervals, authorized data types, etc.)

#### Step 2: Authentication Data (Attendance Log)
When a child scans their face, the device sends:
```
POST /iclock/cdata?SN=XXXXXX&table=ATTLOG&Stamp=99999999
PIN=12345\t2026-07-22 14:30:00\t1\t1
```
- **PIN** : Child's ZKTeco ID
- **TIME** : Scan date and time
- **STATUS** : 0=Entry, 1=Exit
- **VERIFY** : 0=Password, 1=Fingerprint, 2=Card, 9=Face

#### Step 3: Verification and Response
Server receives the log, checks in database:
1. If PIN exists in `children` table (`zkteco_id` field)
2. If child has an active subscription
3. If time matches an authorized slot (with ±15min/+30min tolerance)
4. **Returns "OK"** if access granted, or silently refuses

#### Step 4: Server to Device Commands
Device periodically queries the server:
```
GET /iclock/getrequest?SN=XXXXXX
```
Server can return commands:
- `DATA USER PIN=%d...` → Add/modify user (face)
- `DATA DEL_USER PIN=%d` → Delete user
- `AC_UNLOCK` → Unlock door
- `REBOOT` → Reboot device
- `CLEAR LOG` → Clear logs
- `SET OPTION IPAddress=...` → Configure device

### 8.4. User (Face) Synchronization

#### Adding a child to the application:
1. Admin creates child in web interface
2. Admin registers face on ZKTeco (via device or API)
3. ZKTeco generates a **PIN** (unique ID)
4. Admin enters this PIN in the child's profile on the application
5. Application sends command to ZKTeco to associate access schedules:
   ```
   DATA USER PIN=12345\tName=ChildX\tGrp=1\tTZ=1
   ```
6. Access schedules are configured via Time Zones (TZ)

### 8.5. Time Zones Management
ZKTeco uses **Time Zones** to define access periods:
```
UPDATE TIMEZONE TZID=1\tITIME=08:00-17:00\tRESERVE=
```
- Each child is associated with a Time Zone via the `TZ` field
- Application must convert subscription slots to ZKTeco Time Zones
- Example: Monday 2pm-4pm session → Time Zone with access 1:45pm-4:30pm (with tolerances)

### 8.6. Logs and Absence Management

#### Access logs received from ZKTeco:
```
POST /iclock/cdata?SN=XXXXXX&table=ATTLOG&Stamp=99999999
PIN=12345\t2026-07-22 14:30:00\t1\t1
PIN=12345\t2026-07-22 16:00:00\t1\t0
```

#### Server-side processing:
1. Entry log reception → Access rights verification
2. If granted → Record in `access_logs` + Mark "Present" in `absences`
3. If denied → Record in `access_logs` with "denied" status + reason
4. At end of each slot, automatic verification:
   - If no entry log received → Automatic "Absent" marking
   - If entry but no exit → "Early departure" marking

### 8.7. Offline Mode

#### ZKTeco autonomous operation:
- Registered faces stored locally on device
- Access logs accumulated in internal memory
- Access decisions (granted/denied) made locally based on:
  - Registered user list (faces)
  - Configured time slots (Time Zones)
  - Entry tolerances

#### Synchronization on connection restore:
1. Device detects network connection recovery
2. Sends all accumulated logs via `POST /iclock/cdata?table=ATTLOG`
3. Server processes logs and updates database
4. Device clears log buffer after confirmation

### 8.8. Supported API Commands

| Command | Description | Usage |
|----------|-------------|-------|
| `DATA USER` | Add/modify user | Child creation |
| `DATA DEL_USER` | Delete user | Child deletion |
| `DATA FP` | Add fingerprint | Biometric registration |
| `ENROLL_FP` | Start enrollment | On-device registration |
| `UPDATE TIMEZONE` | Configure time slot | Access definition |
| `DELETE TIMEZONE` | Delete time slot | Access deactivation |
| `UPDATE USERPIC` | Download photo | Face update |
| `DELETE USERPIC` | Delete photo | Face deletion |
| `AC_UNLOCK` | Unlock door | Remote opening |
| `AC_UNALARM` | Cancel alarm | Alarm deactivation |
| `QUERY ATTLOG` | Query logs | Passage history |
| `CLEAR LOG` | Clear logs | Cleanup |
| `REBOOT` | Reboot | Maintenance |
| `SET OPTION` | Configure device | Network/IP settings |
| `GET OPTION` | Read configuration | Device status |
| `INFO` | Device info | Diagnostics |
| `CHECK` | Check new data | Synchronization |
| `LOG` | Force data upload | Immediate update |

### 8.9. Data Exchange Formats

#### Access log (Attendance Record):
```
POST /iclock/cdata?SN=ABC123&table=ATTLOG&Stamp=123456789
PIN=1001\t2026-07-22 14:30:00\t1\t1
```
- **PIN** : User's ZKTeco ID
- **TIME** : Scan timestamp
- **STATUS** : 0=Entry, 1=Exit, 2=Pause in, 3=Pause out
- **VERIFY** : 0=Password, 1=Fingerprint, 2=Card, 9=Face

#### Verification photo (Attendance Photo):
```
POST /iclock/cdata?SN=ABC123&table=ATTPHOTO&Stamp=123456789
PIN=20260722143000-1001
SN=ABC123
size=24576
CMD=uploadphoto
[BINARY IMAGE DATA - JPG format]
```

#### Server response (success):
```
HTTP/1.1 200 OK
Content-Type: text/plain

OK
```

---

## 9. Technical Constraints

- Application must work **online and offline** for access control
- Access schedule data must be **cached locally** on the ZKTeco device
- Synchronization must be **automatic** when connection is restored
- Interface language: **French**
- Prices and discounts **fully configurable** from the interface
- Server must implement PUSH SDK endpoints:
  - `GET /iclock/cdata` — Receive device data
  - `POST /iclock/cdata` — Receive logs/photos
  - `GET /iclock/getrequest` — Command queue
  - `POST /iclock/devicecmd` — Command execution return
- Server must return standard HTTP headers with `Date` for time synchronization
- Queued commands must not exceed 200 commands / 40 KB
- UDP support for faster command delivery (port 4374)