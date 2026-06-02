# CHENGETO Threat Model Template

Use this template for features that introduce a new trust boundary, sensitive workflow, external integration, or privileged capability.

## Change summary

- feature or change:
- owner:
- date:

## Assets affected

- patient data
- user credentials or sessions
- audit data
- device telemetry
- notifications or third-party credentials

## Entry points

- API routes:
- frontend screens:
- background jobs:
- webhooks or third-party callbacks:

## Trust boundaries

- browser to frontend
- frontend to backend
- backend to database
- backend to third-party providers
- operator access to hosted environment

## Main abuse cases

- unauthorized access
- privilege escalation
- data tampering
- sensitive data exposure
- denial of service
- insecure secret handling

## Mitigations

- authn/authz:
- validation/sanitization:
- logging/audit:
- rate limiting:
- secret handling:
- rollback/containment:

## Residual risks

- risk:
- reason accepted:
- follow-up action:

