# CHENGETO on Render

This guide documents the minimum secure setup for hosting CHENGETO on Render behind Cloudflare.

## Services

- `frontend`: Render web service built from `frontend/Dockerfile`
- `backend`: Render web service built from `backend/Dockerfile`
- managed MongoDB/Redis or externally hosted equivalents

## Required backend environment variables

Set these in the Render backend service:

- `NODE_ENV=production`
- `PORT=5000`
- `MONGODB_URI=<managed mongodb connection string>`
- `REDIS_URL=<managed redis connection string>`
- `JWT_SECRET=<long random secret>`
- `REFRESH_TOKEN_SECRET=<long random secret>`
- `ENCRYPTION_KEY=<32 character secret>`
- `CORS_ORIGIN=https://chengeto.health,https://www.chengeto.health`
- `MQTT_DEMO_AUTH=false`

Set these only if used:

- `BLOCKCHAIN_RPC_URL`
- `BLOCKCHAIN_PRIVATE_KEY`
- `CONTRACT_ADDRESS`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

## Required frontend build variables

Set these in the Render frontend service build environment:

- `VITE_API_URL=https://api.chengeto.health/api/v1`
- `VITE_SOCKET_URL=https://api.chengeto.health`

Optional public variables:

- `VITE_PUBLIC_CONTACT_EMAIL`
- `VITE_PUBLIC_CONTACT_PHONE`
- `VITE_PUBLIC_CONTACT_WHATSAPP`
- `VITE_PUBLIC_CAREERS_EMAIL`
- `VITE_PUBLIC_ZWL_PER_USD`

## Cloudflare notes

- Proxy only the public frontend and API hostnames
- Use Full (strict) TLS mode
- Do not expose MongoDB, Redis, or private admin ports publicly
- Keep CORS origin allowlists aligned with the Cloudflare-served domains

## Release and rollback

- Deploy from the default protected branch only
- Confirm GitHub Actions checks pass before approving a Render deploy
- If a deploy fails, roll back to the last healthy Render deploy before retrying
- Rotate secrets immediately if they are ever committed or exposed in logs

See also:

- `docs/SECRET_ROTATION_RUNBOOK.md`
- `docs/RENDER_RELEASE_RUNBOOK.md`
- `docs/RENDER_ALERTING_BASELINE.md`
