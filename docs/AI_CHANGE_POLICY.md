# CHENGETO AI-Assisted Change Policy

## AI may draft

- documentation
- non-production scripts
- tests
- workflow proposals
- infrastructure proposals

## AI may not merge or finalize without human review

- GitHub Actions that change security gates or deployment behavior
- Dockerfile changes affecting runtime posture
- `render.yaml` or Terraform changes affecting public exposure, secrets, DNS, or TLS
- authn/authz changes
- backup, restore, or secret-rotation procedures

## Verification requirement

Any AI-generated change affecting operations or security must have deterministic verification before merge:

- tests or lint for app changes
- dry-run, validate, or plan output for IaC/workflows where possible
- explicit reviewer signoff for production-impacting changes
