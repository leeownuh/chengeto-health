# MongoDB Atlas (Data Explorer) Seeding Guide (No Shell Required)

This guide lets you seed **CHENGETO Health** using **MongoDB Atlas → Data Explorer** only (no Render shell, no local seed script).

It is designed to match the current backend Mongoose model collection names exactly.

## 0) Create / select the database

- **Database name:** `chengeto_health`

## 1) Create the required collections

Create these collections under `chengeto_health`:

| Collection | Backing model | Why it matters |
|---|---|---|
| `users` | `User` | Login + RBAC |
| `patients` | `Patient` | Dashboards + patient views |
| `careschedules` | `CareSchedule` | Schedule/appointments page |
| `iotdevices` | `IoTDevice` | Device registry + patient device health |
| `iottelemetries` | `IoTTelemetry` | Monitoring/vitals panels + alert triggers |
| `checkins` | `CheckIn` | Check-in workflow + history |
| `alerts` | `Alert` | Alert list/detail + escalation |
| `audit_logs` | `AuditLog` | Audit trail screens + compliance evidence |
| `caretransitions` (optional) | `CareTransition` | Discharge/follow-up workflow |

## 2) Generate a demo password hash (bcrypt)

The backend login uses `bcrypt.compare()` against the stored `users.password`. If you insert users via GUI, you **must** store a bcrypt hash (not plain text).

On your machine:

```powershell
cd C:\Projects\chengeto\backend
node -e "import('bcryptjs').then(b=>b.default.hash('Demo@123456',12)).then(h=>console.log(h))"
```

Copy the printed hash. In the steps below, paste it as `<BCRYPT_HASH>`.

## 3) Seed `users` (login accounts)

In Atlas Data Explorer:
- Go to `chengeto_health.users`
- Click **Insert Document**
- Insert the following documents one by one (replace `<BCRYPT_HASH>` with your generated hash)

### 3.1 Admin

```json
{
  "email": "admin@chengeto.health",
  "password": "<BCRYPT_HASH>",
  "firstName": "System",
  "lastName": "Administrator",
  "phone": "+263771000001",
  "role": "admin",
  "status": "active",
  "emailVerified": true,
  "phoneVerified": true,
  "mfaEnabled": false,
  "permissions": [
    "read:patients","write:patients","delete:patients",
    "read:caregivers","write:caregivers","delete:caregivers",
    "read:alerts","write:alerts","acknowledge:alerts","escalate:alerts",
    "read:checkins","write:checkins","verify:checkins",
    "read:devices","write:devices","provision:devices",
    "read:blockchain","write:blockchain",
    "read:audit","export:audit",
    "manage:users","manage:schedules","manage:system",
    "access:admin","access:reports"
  ]
}
```

### 3.2 CHW

```json
{
  "email": "chw1@chengeto.health",
  "password": "<BCRYPT_HASH>",
  "firstName": "Nyasha",
  "lastName": "Mukamuri",
  "phone": "+263771000011",
  "role": "chw",
  "status": "active",
  "emailVerified": true,
  "phoneVerified": true,
  "mfaEnabled": false,
  "ward": "Ward 16",
  "district": "Harare",
  "permissions": [
    "read:patients","write:patients",
    "read:caregivers",
    "read:alerts","acknowledge:alerts","escalate:alerts",
    "read:checkins","write:checkins","verify:checkins",
    "read:devices",
    "access:reports"
  ]
}
```

### 3.3 Caregiver

```json
{
  "email": "caregiver1@example.com",
  "password": "<BCRYPT_HASH>",
  "firstName": "Tariro",
  "lastName": "Moyo",
  "phone": "+263771000021",
  "role": "caregiver",
  "status": "active",
  "emailVerified": true,
  "phoneVerified": true,
  "mfaEnabled": false,
  "isPrimaryCaregiver": true,
  "specializations": ["Medication adherence","Home visits"],
  "permissions": [
    "read:patients",
    "read:alerts","acknowledge:alerts",
    "read:checkins","write:checkins",
    "read:devices"
  ]
}
```

### 3.4 Clinician

```json
{
  "email": "clinician1@chengeto.health",
  "password": "<BCRYPT_HASH>",
  "firstName": "Dr.",
  "lastName": "Chirwa",
  "phone": "+263771000031",
  "role": "clinician",
  "status": "active",
  "emailVerified": true,
  "phoneVerified": true,
  "mfaEnabled": false,
  "specialization": "General Practice",
  "permissions": [
    "read:patients","write:patients",
    "read:alerts","acknowledge:alerts","escalate:alerts",
    "read:checkins",
    "read:devices",
    "access:reports"
  ]
}
```

### 3.5 Family

```json
{
  "email": "family1@example.com",
  "password": "<BCRYPT_HASH>",
  "firstName": "Chipo",
  "lastName": "Moyo",
  "phone": "+263771000041",
  "role": "family",
  "status": "active",
  "emailVerified": true,
  "phoneVerified": true,
  "mfaEnabled": false,
  "permissions": ["read:alerts","read:checkins"]
}
```

### 3.6 Auditor

```json
{
  "email": "auditor@chengeto.health",
  "password": "<BCRYPT_HASH>",
  "firstName": "Security",
  "lastName": "Auditor",
  "phone": "+263771000051",
  "role": "auditor",
  "status": "active",
  "emailVerified": true,
  "phoneVerified": true,
  "mfaEnabled": false,
  "permissions": [
    "read:patients",
    "read:caregivers",
    "read:alerts",
    "read:checkins",
    "read:devices",
    "read:blockchain",
    "read:audit","export:audit"
  ]
}
```

## 4) Copy the `_id` values you’ll need

After inserting users, open each user document and copy its `_id` value:

- `ADMIN_ID` (admin@chengeto.health)
- `CHW_ID` (chw1@chengeto.health)
- `CAREGIVER_ID` (caregiver1@example.com)
- `CLINICIAN_ID` (clinician1@chengeto.health)
- `FAMILY_ID` (family1@example.com)

You’ll paste those ObjectIds into the patient/schedule/device documents.

## 5) Seed `patients`

Go to `chengeto_health.patients` → Insert Document.

Create at least **2** patients. Replace the `..._ID` placeholders with the copied ObjectIds.

### 5.1 Patient A

```json
{
  "patientId": "CHG-2026-00001",
  "firstName": "Mai",
  "lastName": "Chikasha",
  "dateOfBirth": { "$date": "1952-02-11T00:00:00.000Z" },
  "gender": "female",
  "phone": "+263771100001",
  "address": { "village": "Chibvuti", "ward": "16", "district": "Harare", "province": "Harare" },
  "medicalSummary": "Hypertension; requires daily medication adherence monitoring.",
  "riskLevel": "moderate",
  "primaryCaregiver": { "$oid": "<CAREGIVER_ID>" },
  "assignedCHW": { "$oid": "<CHW_ID>" },
  "assignedClinician": { "$oid": "<CLINICIAN_ID>" },
  "emergencyContacts": [
    { "name": "Chipo Moyo", "relationship": "daughter", "phone": "+263771000041", "isPrimary": true, "priority": 1 }
  ],
  "familyMembers": [
    { "user": { "$oid": "<FAMILY_ID>" }, "relationship": "child", "accessLevel": "limited", "approvedAt": { "$date": "2026-04-01T00:00:00.000Z" } }
  ],
  "carePlan": {
    "riskProfile": { "summary": "Moderate fall/medication risk. Needs consistent check-ins." },
    "visitCadence": { "frequency": "daily", "preferredWindow": "morning" },
    "escalationPreferences": { "primaryResponderRole": "caregiver", "notifyFamily": true, "maxResponseMinutes": 30 }
  },
  "functionalBaseline": {
    "mobility": "independent",
    "gait": "stable",
    "balance": "good",
    "frailty": "mild",
    "homeSafety": "moderate"
  }
}
```

### 5.2 Patient B

```json
{
  "patientId": "CHG-2026-00002",
  "firstName": "Sekuru",
  "lastName": "Mavhunga",
  "dateOfBirth": { "$date": "1947-07-05T00:00:00.000Z" },
  "gender": "male",
  "phone": "+263771100002",
  "address": { "village": "Goromonzi", "ward": "12", "district": "Goromonzi", "province": "Mashonaland East" },
  "medicalSummary": "Diabetes; risk of missed doses and inactivity.",
  "riskLevel": "high",
  "primaryCaregiver": { "$oid": "<CAREGIVER_ID>" },
  "assignedCHW": { "$oid": "<CHW_ID>" },
  "assignedClinician": { "$oid": "<CLINICIAN_ID>" },
  "emergencyContacts": [
    { "name": "Tariro Moyo", "relationship": "caregiver", "phone": "+263771000021", "isPrimary": true, "priority": 1 }
  ],
  "carePlan": {
    "riskProfile": { "summary": "High risk due to diabetes and recent near-falls." },
    "visitCadence": { "frequency": "daily", "preferredWindow": "morning" },
    "escalationPreferences": { "primaryResponderRole": "chw", "notifyFamily": true, "maxResponseMinutes": 20 }
  }
}
```

## 6) Seed `iotdevices`

Go to `chengeto_health.iotdevices` → Insert Document.

Create 1 device per patient (patient monitor). Replace `<PATIENT_A_ID>` / `<PATIENT_B_ID>` with the inserted patients’ `_id` values.

### 6.1 Device for Patient A

```json
{
  "deviceId": "DEV-DEMO-A",
  "deviceType": "patient_monitor",
  "model": "CHENGETO-MONITOR",
  "manufacturer": "CHENGETO Lab",
  "capabilities": ["heart_rate", "motion", "fall_detection", "panic_button"],
  "assignedPatient": { "$oid": "<PATIENT_A_ID>" },
  "assignedCaregiver": { "$oid": "<CAREGIVER_ID>" },
  "status": "paired",
  "pairing": { "isPaired": true, "pairedAt": { "$date": "2026-04-01T00:00:00.000Z" } },
  "connection": { "online": true, "lastOnline": { "$date": "2026-04-25T08:00:00.000Z" }, "mqttClientId": "chengeto-demo-a" },
  "power": { "batteryLevel": 72, "batteryStatus": "discharging" },
  "network": { "supportedProtocols": ["mqtt", "http"] }
}
```

### 6.2 Device for Patient B

```json
{
  "deviceId": "DEV-DEMO-B",
  "deviceType": "patient_monitor",
  "model": "CHENGETO-MONITOR",
  "manufacturer": "CHENGETO Lab",
  "capabilities": ["heart_rate", "motion", "fall_detection", "panic_button"],
  "assignedPatient": { "$oid": "<PATIENT_B_ID>" },
  "assignedCaregiver": { "$oid": "<CAREGIVER_ID>" },
  "status": "paired",
  "pairing": { "isPaired": true, "pairedAt": { "$date": "2026-04-01T00:00:00.000Z" } },
  "connection": { "online": true, "lastOnline": { "$date": "2026-04-25T08:05:00.000Z" }, "mqttClientId": "chengeto-demo-b" },
  "power": { "batteryLevel": 55, "batteryStatus": "discharging" },
  "network": { "supportedProtocols": ["mqtt", "http"] }
}
```

## 7) Seed `careschedules` (appointments / day view)

Go to `chengeto_health.careschedules` → Insert Document.

Create 1 schedule per patient. Replace patient/user ids accordingly.

```json
{
  "title": "Daily morning visit",
  "patient": { "$oid": "<PATIENT_A_ID>" },
  "status": "active",
  "effectiveDate": { "$date": "2026-04-01T00:00:00.000Z" },
  "checkinWindows": [
    {
      "name": "morning",
      "startTime": "08:00",
      "endTime": "10:00",
      "gracePeriod": 15,
      "required": true,
      "days": ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],
      "assignedCaregiver": { "$oid": "<CAREGIVER_ID>" }
    }
  ],
  "medicationReminders": [
    {
      "medication": "Amlodipine",
      "dosage": "5mg",
      "unit": "tablet",
      "time": "09:00",
      "withFood": false,
      "active": true,
      "adherenceRule": "required",
      "confirmationSource": "caregiver"
    }
  ],
  "createdBy": { "$oid": "<ADMIN_ID>" },
  "lastModifiedBy": { "$oid": "<ADMIN_ID>" }
}
```

## 8) Seed `iottelemetries` (so vitals panels aren’t empty)

Go to `chengeto_health.iottelemetries` → Insert Document.

Insert a few telemetry points for Patient A:

```json
{
  "deviceId": "DEV-DEMO-A",
  "patient": { "$oid": "<PATIENT_A_ID>" },
  "timestamp": { "$date": "2026-04-25T08:20:00.000Z" },
  "heartRate": { "value": 78, "unit": "bpm", "status": "normal", "source": "ppg" },
  "motion": { "detected": true, "type": "walking", "intensity": "low", "duration": 40 },
  "deviceStatus": { "batteryLevel": 72, "charging": false, "status": "online" },
  "rawData": "{\"demo\":true}"
}
```

Insert one abnormal point (to justify alerts/screenshots):

```json
{
  "deviceId": "DEV-DEMO-A",
  "patient": { "$oid": "<PATIENT_A_ID>" },
  "timestamp": { "$date": "2026-04-25T08:50:00.000Z" },
  "heartRate": { "value": 132, "unit": "bpm", "status": "abnormal", "source": "ppg" },
  "motion": { "detected": false, "type": "sitting", "intensity": "none", "duration": 0 },
  "deviceStatus": { "batteryLevel": 71, "charging": false, "status": "online" },
  "rawData": "{\"demo\":true,\"reason\":\"tachycardia\"}"
}
```

## 9) Seed `alerts` (so alert lists show data)

Go to `chengeto_health.alerts` → Insert Document.

```json
{
  "alertId": "ALT-20260425-0001",
  "patient": { "$oid": "<PATIENT_A_ID>" },
  "type": "vital_sign",
  "severity": "high",
  "title": "Abnormal heart rate detected",
  "message": "Heart rate exceeded configured threshold.",
  "source": { "type": "sensor", "deviceId": "DEV-DEMO-A", "sensorType": "heart_rate", "triggerValue": 132 },
  "status": "pending",
  "escalation": { "currentLevel": 1, "history": [] },
  "vitalSnapshot": { "heartRate": 132 },
  "createdAt": { "$date": "2026-04-25T09:00:00.000Z" },
  "updatedAt": { "$date": "2026-04-25T09:00:00.000Z" }
}
```

## 10) Seed `checkins` (so check-in history shows data)

Go to `chengeto_health.checkins` → Insert Document.

```json
{
  "checkinId": "CHK-20260425-0001",
  "patient": { "$oid": "<PATIENT_A_ID>" },
  "caregiver": { "$oid": "<CAREGIVER_ID>" },
  "type": "scheduled",
  "status": "completed",
  "scheduledTime": { "$date": "2026-04-25T08:30:00.000Z" },
  "actualTime": { "$date": "2026-04-25T08:35:00.000Z" },
  "proximityVerification": {
    "method": "ble",
    "verified": true,
    "verifiedAt": { "$date": "2026-04-25T08:34:00.000Z" },
    "deviceIds": ["DEV-DEMO-A"],
    "signalStrength": -62
  },
  "wellness": { "overallStatus": "good", "mood": "neutral", "appearance": "normal", "consciousness": "alert" },
  "vitals": { "heartRate": { "value": 78, "unit": "bpm", "abnormal": false } },
  "medication": { "adherence": "taken", "dueTodayCount": 1, "takenCount": 1, "missedCount": 0 },
  "createdAt": { "$date": "2026-04-25T08:35:00.000Z" },
  "updatedAt": { "$date": "2026-04-25T08:35:00.000Z" }
}
```

## 11) Seed `audit_logs` (optional but recommended for report evidence)

Go to `chengeto_health.audit_logs` → Insert Document.

```json
{
  "logId": "AUD-20260425-DEMO1",
  "timestamp": { "$date": "2026-04-25T10:00:00.000Z" },
  "action": "login",
  "category": "authentication",
  "result": "success",
  "actor": { "userId": { "$oid": "<ADMIN_ID>" }, "email": "admin@chengeto.health", "role": "admin" },
  "target": { "type": "user", "id": { "$oid": "<ADMIN_ID>" }, "model": "User", "description": "Admin login" },
  "request": { "method": "POST", "endpoint": "/api/v1/auth/login", "ipAddress": "127.0.0.1", "userAgent": "Atlas seed" },
  "details": { "message": "Seeded audit trail for screenshots." }
}
```

## 12) Verify in the web app

Login credentials (password = the plain text you hashed above):
- `admin@chengeto.health` / `Demo@123456`
- `chw1@chengeto.health` / `Demo@123456`
- `caregiver1@example.com` / `Demo@123456`
- `clinician1@chengeto.health` / `Demo@123456`
- `family1@example.com` / `Demo@123456`
- `auditor@chengeto.health` / `Demo@123456`

If login still fails:
- Confirm `users.status` is `"active"`.
- Confirm the stored `users.password` value is a bcrypt hash string starting with `$2a$` or `$2b$`.
