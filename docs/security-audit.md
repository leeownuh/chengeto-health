# Security / Permissions Audit (Practical)

This document is a course-friendly checklist of what is enforced today, what is configurable, and what should be tightened before production use.

## RBAC / Route Protection

- Backend routes should be protected with auth middleware and role checks where needed.
- Frontend routes are guarded by `PrivateRoute` + `RoleRoute`, but **backend remains the source of truth**.

Recommended spot-checks:
- `backend/routes/*` verify `protect` + `authorize` is applied consistently for write operations.
- `backend/routes/iot.routes.js` verify device management is admin-only.

## CORS

- `backend/src/server.js` now defaults to **local dev origins only** when `CORS_ORIGIN` is unset.
- For production set `CORS_ORIGIN` to a comma-separated allowlist.
- Avoid `*` with credentialed requests.

## Rate Limiting

- Global rate limiting is applied under `/api/` via `backend/middleware/rateLimit.middleware.js`.
- Tune `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` per environment.

## MQTT Device Credentials

- Demo mode: `MQTT_DEMO_AUTH=true` accepts any non-empty username/password (simulators).
- Production mode: `MQTT_DEMO_AUTH=false` enforces:
  - `username == IoTDevice.deviceId`
  - `password == IoTDevice.security.apiSecret`

## Audit Logging

Actions that change clinical state should emit audit events (care plan changes, check-in completion, alert resolution/escalation).

Recommended next tightening:
- Ensure every `PATCH/POST/PUT/DELETE` endpoint writes an `AuditLog` entry.
- Ensure audit events include actor id, patient id (when relevant), and before/after snapshots for critical fields.

## Secrets Management

- Do not commit `.env`.
- Use `.env.example` as the template.
- For real deployments: store secrets in a secret manager (GitHub Actions secrets, Doppler, Vault, etc.).

