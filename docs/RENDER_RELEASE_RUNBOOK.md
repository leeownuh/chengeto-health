# CHENGETO Render Release and Rollback Runbook

This runbook documents the minimum safe release path for CHENGETO when using Render behind Cloudflare.

## Release prerequisites

- GitHub Actions checks pass on the release commit
- Required environment variables are present in Render
- Cloudflare DNS and proxy settings already match the intended domains
- Database and Redis dependencies are healthy

## Release flow

1. Merge only reviewed code into the protected release branch.
2. Confirm CI is green:
   - `.github/workflows/ci.yml`
   - `.github/workflows/secrets-scan.yml`
   - `.github/workflows/codeql.yml`
   - `.github/workflows/dependency-audit.yml`
   - `.github/workflows/container-scan.yml`
3. Trigger or approve the Render deploy for `backend`.
4. Verify `backend` health, logs, and API reachability.
5. Trigger or approve the Render deploy for `frontend`.
6. Verify the public site, login flow, core dashboard, and API-backed pages through Cloudflare.
7. Record the deploy version, time, and operator.

## Minimum post-release checks

- `https://api.chengeto.health/health` returns healthy
- `https://chengeto.health/` loads
- Login works
- A protected API request works
- Browser console shows no obvious runtime errors
- Cloudflare-served site reaches the correct API origin

## Rollback triggers

- Backend health check fails after deploy
- Login or core dashboard flow is broken
- Severe frontend runtime error on the public site
- High error rate or obvious regression in production logs

## Rollback flow

1. Roll back the affected Render service to the last healthy deploy.
2. If both services were released and the issue spans both, roll back `frontend` and `backend` together.
3. Re-test the same minimum post-release checks.
4. Pause new deploys until the incident is understood.
5. Create a short incident note with:
   - bad deploy version
   - rollback target version
   - user impact
   - suspected cause

## Notes for config-only changes

- If only frontend `VITE_*` build variables changed, roll back the frontend service first.
- If backend secrets or API configuration changed, roll back the backend service first.
- If Cloudflare settings changed, revert the Cloudflare change before redeploying application code.
