# CHENGETO Security Test Matrix

Use this matrix when expanding backend and frontend verification.

## Required automated coverage

- authentication success and failure cases
- role-based authorization boundaries
- MFA setup and enforcement
- password reset flow
- token refresh flow
- account lockout and rate limiting
- IoT device authentication failure cases
- CORS allowlist enforcement
- input validation on public and privileged endpoints

## Required negative tests

- ordinary user attempting admin-only route
- caregiver attempting clinician-only or auditor-only actions
- invalid refresh token
- expired reset token
- malformed device credentials
- unsafe origin blocked by CORS

## Optional future additions

- log redaction assertions
- provider integration sandbox tests
- provenance verification in CI
