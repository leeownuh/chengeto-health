# Device Integration Spec (MQTT)

This document defines the contract a real hardware device must follow to integrate with CHENGETO without code changes.

## Transport

- MQTT (TCP): `mqtt://<backend-host>:1883`
- MQTT over WebSockets (browser simulators): `ws://<backend-host>:8083`

## Auth

Demo mode (default in compose):
- Any non-empty username/password is accepted.

Production mode:
- Set `MQTT_DEMO_AUTH=false`
- `username = <deviceId>`
- `password = <apiSecret>` from the IoT device registry (`IoTDevice.security.apiSecret`)

## Topic Convention

Base: `chengeto/<patientMongoId>`

- Telemetry publish: `chengeto/<patientId>/telemetry`
- Status publish: `chengeto/<patientId>/status`
- Alert publish: `chengeto/<patientId>/alert`
- Command subscribe: `chengeto/<patientId>/command`

## Telemetry Payload (Publish)

Minimum viable payload:

```json
{
  "timestamp": "2026-04-24T00:00:00.000Z",
  "patientId": "69ea0a3ecb117a5c9e2a213a",
  "deviceId": "PM-001",
  "vitals": {
    "heartRate": 72,
    "oxygenSaturation": 97,
    "temperature": 36.6
  },
  "motion": {
    "activity": "walking",
    "fallDetected": false
  },
  "deviceStatus": {
    "batteryLevel": 85,
    "signalStrength": -55,
    "charging": false,
    "firmwareVersion": "1.0.0"
  }
}
```

Notes:
- Additional sensors are allowed; unknown fields are ignored.
- Backend stores telemetry in MongoDB and emits realtime UI updates.

## Alert Payload (Publish)

Example panic alert:

```json
{
  "type": "panic",
  "severity": "critical",
  "message": "Panic button activated",
  "patientId": "69ea0a3ecb117a5c9e2a213a",
  "deviceId": "PM-001",
  "timestamp": "2026-04-24T00:00:00.000Z"
}
```

## Commands (Subscribe)

Devices should subscribe to `chengeto/<patientId>/command` and handle JSON messages.

Recommended command envelope:

```json
{
  "commandId": "uuid",
  "type": "set_sampling_rate",
  "params": { "heartRateHz": 1 },
  "issuedAt": "2026-04-24T00:00:00.000Z"
}
```

Optional: publish an acknowledgement on `chengeto/<patientId>/status`.

