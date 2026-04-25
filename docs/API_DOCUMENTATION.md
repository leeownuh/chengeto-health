# CHENGETO Health API Documentation

## Overview

The CHENGETO Health API provides RESTful endpoints for managing patient care, IoT telemetry, alerts, and check-ins. The API supports real-time updates via WebSockets and MQTT for IoT device communication.

**Base URL:** `/api/v1` (Docker Compose default: `http://localhost:5000/api/v1`)  
**API Version:** 1.0.0  
**Content-Type:** `application/json`

Compatibility:

- The backend also exposes legacy aliases under `/api/*` for older frontend screens, but new integrations should use `/api/v1/*`.

---

## Authentication

All API requests require authentication using JWT Bearer tokens.

### Headers

```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

### Endpoints

#### Register User

```
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass@123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+263 77 123 4567",
  "role": "caregiver"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "64a1b2c3d4e5f6g7h8i9j0k1",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "caregiver",
      "verified": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login

```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass@123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "64a1b2c3d4e5f6g7h8i9j0k1",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "caregiver"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Get Current User

```
GET /api/auth/me
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6g7h8i9j0k1",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "caregiver",
    "phone": "+263 77 123 4567",
    "verified": true,
    "mfaEnabled": false
  }
}
```

#### Forgot Password

```
POST /api/auth/forgot-password
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### Reset Password

```
POST /api/auth/reset-password
```

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePass@123"
}
```

---

## Patients

### List Patients

```
GET /api/patients
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default: 1) |
| limit | integer | Items per page (default: 20, max: 100) |
| search | string | Search by name or patient ID |
| status | string | Filter by status (active, inactive) |
| chw | string | Filter by assigned CHW ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "patients": [
      {
        "_id": "64a1b2c3d4e5f6g7h8i9j0k2",
        "patientId": "PAT-2024-001",
        "firstName": "Maria",
        "lastName": "Santos",
        "dateOfBirth": "1955-05-15T00:00:00.000Z",
        "gender": "female",
        "phone": "+263 77 987 6543",
        "address": {
          "street": "123 Health Street",
          "city": "Harare",
          "country": "Zimbabwe"
        },
        "active": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

### Get Patient

```
GET /api/patients/:id
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6g7h8i9j0k2",
    "patientId": "PAT-2024-001",
    "firstName": "Maria",
    "lastName": "Santos",
    "dateOfBirth": "1955-05-15T00:00:00.000Z",
    "gender": "female",
    "bloodType": "O+",
    "phone": "+263 77 987 6543",
    "address": {
      "street": "123 Health Street",
      "city": "Harare",
      "province": "Harare",
      "country": "Zimbabwe"
    },
    "emergencyContact": {
      "name": "John Santos",
      "relationship": "Son",
      "phone": "+263 77 111 2222"
    },
    "diagnoses": [
      {
        "condition": "Type 2 Diabetes",
        "diagnosedDate": "2020-01-15T00:00:00.000Z",
        "status": "active"
      }
    ],
    "medications": [
      {
        "name": "Metformin",
        "dosage": "500mg",
        "frequency": "Twice daily"
      }
    ],
    "allergies": ["Penicillin"],
    "assignedCHW": {
      "_id": "64a1b2c3d4e5f6g7h8i9j0k3",
      "firstName": "Ruth",
      "lastName": "Moyo"
    },
    "primaryCaregiver": {
      "_id": "64a1b2c3d4e5f6g7h8i9j0k4",
      "firstName": "Grace",
      "lastName": "Santos"
    },
    "vitalThresholds": {
      "heartRate": {
        "min": 50,
        "max": 120,
        "critical": { "min": 40, "max": 150 }
      },
      "bloodPressure": {
        "systolic": { "min": 90, "max": 160 },
        "diastolic": { "min": 50, "max": 100 }
      }
    },
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Create Patient

```
POST /api/patients
```

**Required Role:** admin, clinician, chw

**Request Body:**
```json
{
  "firstName": "Maria",
  "lastName": "Santos",
  "dateOfBirth": "1955-05-15",
  "gender": "female",
  "bloodType": "O+",
  "phone": "+263 77 987 6543",
  "address": {
    "street": "123 Health Street",
    "city": "Harare",
    "country": "Zimbabwe"
  },
  "emergencyContact": {
    "name": "John Santos",
    "relationship": "Son",
    "phone": "+263 77 111 2222"
  },
  "assignedCHW": "64a1b2c3d4e5f6g7h8i9j0k3",
  "primaryCaregiver": "64a1b2c3d4e5f6g7h8i9j0k4",
  "diagnoses": [
    { "condition": "Type 2 Diabetes" }
  ],
  "allergies": ["Penicillin"]
}
```

### Update Patient

```
PUT /api/patients/:id
```

**Request Body:** (partial update)
```json
{
  "phone": "+263 77 999 8888",
  "address": {
    "street": "456 New Address",
    "city": "Bulawayo"
  }
}
```

### Delete Patient (Soft Delete)

```
DELETE /api/patients/:id
```

**Required Role:** admin

### Get Patient Vitals History

```
GET /api/patients/:id/vitals
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | string | Start date (ISO 8601) |
| endDate | string | End date (ISO 8601) |
| type | string | Vital type filter |

---

## Check-ins

### Create Check-in

```
POST /api/checkins
```

**Request Body:**
```json
{
  "patient": "64a1b2c3d4e5f6g7h8i9j0k2",
  "verificationMethod": "BLE",
  "location": {
    "latitude": -17.8292,
    "longitude": 31.0534,
    "accuracy": 10
  },
  "vitals": {
    "heartRate": 72,
    "bloodPressure": {
      "systolic": 120,
      "diastolic": 80
    },
    "temperature": 36.6,
    "oxygenSaturation": 98
  },
  "wellnessAssessment": {
    "overallFeeling": 4,
    "painLevel": 1,
    "mobilityStatus": "normal",
    "appetiteLevel": "good",
    "sleepQuality": "good",
    "notes": "Patient feeling well",
    "overallScore": 85
  },
  "medicationsAdministered": ["Metformin 500mg"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Check-in recorded successfully",
  "data": {
    "_id": "64a1b2c3d4e5f6g7h8i9j0k5",
    "patient": "64a1b2c3d4e5f6g7h8i9j0k2",
    "caregiver": "64a1b2c3d4e5f6g7h8i9j0k4",
    "verificationMethod": "BLE",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "vitals": {
      "heartRate": 72,
      "bloodPressure": { "systolic": 120, "diastolic": 80 }
    },
    "wellnessAssessment": {
      "overallScore": 85
    },
    "blockchainHash": "0x1234...abcd"
  }
}
```

### List Check-ins

```
GET /api/checkins
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| patient | string | Filter by patient ID |
| caregiver | string | Filter by caregiver ID |
| verificationMethod | string | BLE, NFC, GPS, MANUAL |
| startDate | string | Start date |
| endDate | string | End date |
| page | integer | Page number |
| limit | integer | Items per page |

### Get Check-in Details

```
GET /api/checkins/:id
```

### Get Patient Check-in History

```
GET /api/checkins/patient/:patientId/history
```
C:/Projects/chengeto/frontend/public/brand/chengeto-logo-rect.png
---

## Alerts

### List Alerts

```
GET /api/alerts
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | active, acknowledged, resolved, escalated |
| severity | string | low, medium, high, critical |
| type | string | vital_critical, vital_warning, missed_checkin, etc. |
| patient | string | Filter by patient ID |
| page | integer | Page number |
| limit | integer | Items per page |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "_id": "64a1b2c3d4e5f6g7h8i9j0k6",
        "patient": {
          "_id": "64a1b2c3d4e5f6g7h8i9j0k2",
          "firstName": "Maria",
          "lastName": "Santos"
        },
        "type": "vital_critical",
        "severity": "critical",
        "status": "active",
        "message": "Critical: Heart rate dangerously high",
        "vitals": {
          "heartRate": 150
        },
        "escalationLevel": 0,
        "createdAt": "2024-01-15T08:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    }
  }
}
```

### Create Alert

```
POST /api/alerts
```

**Request Body:**
```json
{
  "patient": "64a1b2c3d4e5f6g7h8i9j0k2",
  "type": "missed_checkin",
  "severity": "high",
  "message": "Patient missed scheduled check-in"
}
```

### Acknowledge Alert

```
PUT /api/alerts/:id/acknowledge
```

**Request Body:**
```json
{
  "notes": "Investigating the alert"
}
```

### Resolve Alert

```
PUT /api/alerts/:id/resolve
```

**Request Body:**
```json
{
  "resolution": "False alarm - patient was exercising"
}
```

### Escalate Alert

```
PUT /api/alerts/:id/escalate
```

**Request Body:**
```json
{
  "reason": "Patient not responding to calls"
}
```

### Get Alert Statistics

```
GET /api/alerts/stats
```

---

## IoT Telemetry

### Submit Telemetry

```
POST /api/iot/telemetry
```

**Request Body:**
```json
{
  "deviceId": "BLE-DEVICE-001",
  "patient": "64a1b2c3d4e5f6g7h8i9j0k2",
  "type": "wearable",
  "data": {
    "heartRate": 75,
    "steps": 3500,
    "calories": 180
  }
}
```

### Get Device Telemetry

```
GET /api/iot/devices/:deviceId/telemetry
```

---

## Dashboard

### Get Dashboard Overview

```
GET /api/dashboard/overview
```

**Response varies by user role:**

**For CHW:**
```json
{
  "success": true,
  "data": {
    "totalPatients": 25,
    "todayCheckIns": 12,
    "pendingVisits": 3,
    "activeAlerts": 2,
    "recentActivity": [...]
  }
}
```

**For Admin:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 100,
    "totalPatients": 250,
    "totalCheckIns": 1500,
    "activeAlerts": 15,
    "systemHealth": {
      "database": "healthy",
      "mqtt": "connected",
      "blockchain": "synced"
    }
  }
}
```

---

## WebSocket Events

Connect to: `wss://api.chengeto.health/socket.io`

### Events

| Event | Description | Payload |
|-------|-------------|---------|
| `connect` | Connected to server | - |
| `alert:new` | New alert created | Alert object |
| `alert:update` | Alert status changed | Alert object |
| `checkin:new` | New check-in recorded | Check-in object |
| `telemetry:update` | Real-time telemetry | Telemetry object |
| `notification` | User notification | Notification object |

### Example Usage

```javascript
import io from 'socket.io-client';

const socket = io('wss://api.chengeto.health', {
  auth: { token: 'your_jwt_token' }
});

socket.on('alert:new', (alert) => {
  console.log('New alert:', alert);
});

socket.on('checkin:new', (checkIn) => {
  console.log('New check-in:', checkIn);
});
```

---

## MQTT Protocol

The app uses an embedded Aedes MQTT broker for device ingestion.

Local (Docker Compose defaults):

- TCP: `mqtt://localhost:1883`
- WebSocket (browser): `ws://localhost:8083`

### Topics

Topic format: `chengeto/<patientId>/<dataType>`

| Topic | Direction | Description |
|-------|-----------|-------------|
| `chengeto/<patientId>/telemetry` | Publish | Device publishes vitals + status telemetry |
| `chengeto/<patientId>/status` | Publish | Device heartbeat / presence updates |
| `chengeto/<patientId>/alert` | Publish | Device raises a panic/fall/etc alert |
| `chengeto/<patientId>/command` | Subscribe | Device receives server commands |

### Telemetry Format

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "patientId": "64a1b2c3d4e5f6g7h8i9j0k1",
  "deviceId": "BLE-DEVICE-001",
  "vitals": {
    "heartRate": 72,
    "spo2": 97,
    "temperature": 36.6
  },
  "motion": {
    "activity": "resting",
    "fallDetected": false
  },
  "deviceStatus": {
    "battery": 82,
    "signal": -61
  }
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation error |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

- **Default:** 100 requests per 15 minutes
- **Authentication endpoints:** 5 requests per minute
- Headers included in response:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

---

## Roles and Permissions

| Role | Permissions |
|------|-------------|
| admin | Full system access, user management, settings |
| clinician | Patient management, medical records, alerts |
| chw | Assigned patients, check-ins, schedules |
| caregiver | Primary patients, check-ins, vitals |
| family | View assigned patients, receive alerts |
| auditor | Read-only access, audit logs |

---

## Blockchain Verification

Check-ins and critical events are recorded on the blockchain for audit integrity.

### Verify Record

```
GET /api/blockchain/verify/:hash
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "transactionHash": "0x1234...abcd",
    "blockNumber": 12345678,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Versioning

The API uses URL versioning (e.g., `/api/v1/patients`). The current version is v1.

---

## Support

- **Documentation:** https://docs.chengeto.health
- **API Status:** https://status.chengeto.health
- **Support Email:** support@chengeto.health
