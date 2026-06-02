# CHENGETO Secure Coding Patterns

Use this document for application and operations changes that can affect security posture.

## Authentication and authorization

- Use backend middleware as the source of truth. Frontend route guards are convenience controls, not the enforcement boundary.
- Apply `authenticate` before any protected route.
- Apply `authorize([...])` or permission helpers for role-restricted operations.
- Require `requireMFA` on sensitive account and admin actions when MFA is enabled.

## Input handling

- Validate all external input with `express-validator`.
- Keep request body limits explicit.
- Preserve `helmet`, `mongoSanitize`, `xss-clean`, `hpp`, and rate limiting on the main HTTP path.
- Do not add wildcard CORS for credentialed production traffic.

## Logging

- Preserve `X-Request-Id` end to end.
- Never log secrets, passwords, tokens, refresh tokens, reset tokens, or raw credential payloads.
- Use structured fields instead of free-form sensitive payload dumps.
- Add audit entries for high-risk state changes and security-sensitive events.

## Secrets and config

- Store production secrets in provider-managed secrets only.
- Keep `.env.example` files non-secret and aligned with code.
- Separate build-time public values from runtime secrets.
- Rotate secrets using `docs/SECRET_ROTATION_RUNBOOK.md`.

## External integrations

- Treat SMS, SMTP, blockchain, and device integrations as untrusted boundaries.
- Validate inbound payloads, authenticate callers, and log failures without leaking credentials.
- Apply specific rate limiters for device and auth-related endpoints.

## Workflow and infrastructure changes

- Any GitHub Actions, Dockerfile, `render.yaml`, or Terraform change requires security-aware review.
- Changes that weaken checks, permissions, network exposure, or provenance controls require explicit approval.
