# CHENGETO Secret Rotation Runbook

This runbook defines what to rotate, when to rotate it, and the minimum safe process for CHENGETO in hosted environments such as Render.

## Rotation cadence

- `JWT_SECRET`: rotate every 90 days or immediately after exposure
- `REFRESH_TOKEN_SECRET`: rotate every 90 days or immediately after exposure
- `ENCRYPTION_KEY`: rotate only with a planned maintenance window and data-impact review
- `TWILIO_AUTH_TOKEN`: rotate every 90 days or immediately after exposure
- `SMTP_PASS`: rotate every 90 days or immediately after exposure
- `BLOCKCHAIN_PRIVATE_KEY`: rotate immediately after exposure and review all dependent contracts and wallets
- `VAPID_PRIVATE_KEY`: rotate only with a coordinated client re-registration plan

## Immediate rotation triggers

- A secret is committed to git, pasted into a ticket, or exposed in logs
- A team member with production secret access leaves or loses account control
- A third-party provider reports compromise or suspicious access
- Cloudflare or Render credentials are suspected to be exposed

## Minimum safe process

1. Create the replacement secret before changing production.
2. Record where the old secret is used: Render service env vars, Cloudflare settings, third-party consoles, local operator machines.
3. Apply the new secret in the provider console.
4. Redeploy the affected Render service.
5. Verify health checks, login flow, and any directly impacted integration.
6. Revoke or delete the old secret after successful verification.
7. Record the rotation date and operator in your operations log.

## CHENGETO-specific notes

### `JWT_SECRET` and `REFRESH_TOKEN_SECRET`

- Rotating these secrets invalidates existing sessions.
- Plan this during a low-traffic window.
- After rotation, verify login, token refresh, and protected API access.

### `ENCRYPTION_KEY`

- Treat this as high risk and high impact.
- If encrypted data depends on a single static key, do not rotate casually.
- Review application behavior first and schedule rotation only with a migration plan.

### `CORS_ORIGIN`

- This is configuration, not a secret, but changes can still break production.
- When frontend domains change, update `CORS_ORIGIN` and verify login, API calls, and Socket.IO connections.

## Verification checklist

- Backend `/health` responds successfully
- Frontend loads through Cloudflare
- Login succeeds
- Token-protected API calls succeed
- Real-time features still connect if Socket.IO is enabled
- Third-party integrations still authenticate

## If a secret was exposed in git

1. Rotate the secret first.
2. Redeploy the affected services.
3. Treat the old secret as compromised permanently.
4. Review logs and provider audit trails if available.
5. Do not rely on "the repo is private" as mitigation.
