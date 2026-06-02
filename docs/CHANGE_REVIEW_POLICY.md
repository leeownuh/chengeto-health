# CHENGETO Change Review Policy

## Mandatory security-aware review

Require at least one reviewer for all changes. Require an operations-aware reviewer for:

- `.github/workflows/**`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `render.yaml`
- `infra/**`
- auth and middleware changes under `backend/`
- docs that change deployment, rollback, backup, or secret-handling steps

## Approval expectations

- Workflow or infrastructure changes that affect deploys, checks, secrets, DNS, or TLS must be approved by `Platform` or `DevEx`.
- Authn/authz changes must be approved by `AppSec` or a designated backend owner.
- Monitoring, alerting, backup, and restore changes must be approved by `Operations`.

## Merge prerequisites

- CI green
- security checklist completed in the PR template
- rollback path documented for production-impacting changes
