# CHENGETO Authorization Audit

Last reviewed: 2026-06-02

This document records the backend authorization review required before production launch.

## Scope reviewed

- `backend/routes/auth.routes.js`
- `backend/routes/patient.routes.js`
- `backend/routes/patient.compat.routes.js`
- `backend/routes/alert.routes.js`
- `backend/routes/alert.compat.routes.js`
- `backend/routes/checkin.routes.js`
- `backend/routes/checkin.compat.routes.js`
- `backend/routes/iot.routes.js`
- `backend/routes/dashboard.routes.js`
- `backend/routes/user.routes.js`
- `backend/routes/careTransition.routes.js`
- `backend/routes/blockchain.routes.js`

## Findings summary

- `pass`: core route modules consistently use `authenticate` and `authorize(...)` helpers for protected access.
- `pass`: blockchain verification routes are limited to `admin`, `auditor`, and `clinician`.
- `pass`: dashboard audit-oriented views include `auditor` access where expected.
- `pass`: IoT telemetry ingestion requires device or user authentication.
- `partial`: stricter rate limiters existed but were not fully wired on every sensitive path. Password reset and IoT telemetry are now explicitly rate-limited.
- `partial`: audit-log creation exists in many write flows, but consistency still depends on route-level implementation rather than a single enforcement layer.

## Production requirements still open

- Review every `POST`, `PUT`, `PATCH`, and `DELETE` path for audit-log writes and record exceptions.
- Add automated authorization regression tests for privilege escalation and role boundary failures.
- Add a central helper or middleware pattern for audit-log writes on high-risk state changes.

## Evidence

- route files listed above
- `backend/middleware/auth.middleware.js`
- `backend/middleware/rateLimit.middleware.js`
- `backend/routes/auth.routes.js`
- `backend/routes/iot.routes.js`
