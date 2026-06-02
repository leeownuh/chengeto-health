## What changed

Describe the user-visible or operational change in a few lines.

## Verification

- [ ] `backend` tests or lint run when backend code changed
- [ ] `frontend` tests or lint run when frontend code changed
- [ ] deployment or config impact reviewed if infrastructure or env vars changed

## Security review checklist

- [ ] authn/authz impact reviewed
- [ ] input validation reviewed
- [ ] secrets or credentials not added to code, logs, or screenshots
- [ ] logging avoids tokens, passwords, and sensitive payloads
- [ ] rate limiting, CORS, and headers reviewed if API behavior changed
- [ ] file upload, webhook, or external integration risk reviewed if applicable
- [ ] rollback path is clear if this affects production behavior

## Threat model check

- [ ] no new trust boundary introduced
- [ ] or threat model updated: `docs/THREAT_MODEL_TEMPLATE.md`

## Ops notes

- [ ] no production env var changes required
- [ ] or env var / Render / Cloudflare changes documented

