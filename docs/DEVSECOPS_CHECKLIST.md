# CHENGETO DevSecOps Checklist

Use this document as the production-readiness gate for CHENGETO. It is intentionally repo-specific: each item should map to code, workflow configuration, or an explicit operator process.

**Last repo scan:** 2026-06-02
**Primary owner:** DevEx / DevSecOps
**Deployment model assumed by this checklist:** Render + Cloudflare + managed MongoDB/Redis
**Review cadence:** weekly until launch, then monthly or after any production incident

## How to use this document

1. Treat Sections 1 and 7 as hard production gates.
2. Do not change `[ ]` to `[x]` without linking evidence in the relevant ticket, PR, runbook, or provider console export.
3. If an item is implemented manually but not automated or tested, mark it `[~]`, not `[x]`.
4. Re-run this review after changes to GitHub Actions, Dockerfiles, auth flows, provider configuration, domains, secrets, or monitoring.

## Status legend

- `[x]` implemented in repo or documented with a usable runbook
- `[~]` partially implemented, documented only, or implemented without enforcement
- `[ ]` missing for production

## Evidence required before marking production-ready

| Area | Minimum evidence |
|------|------------------|
| Branch protection | screenshot/export of GitHub branch rules plus required checks list |
| CD | merged workflow file, one successful staging deploy, one successful production deploy |
| Image publishing | registry links showing immutable tags/digests for backend and frontend |
| Signing / provenance | signature verification output and attestation artifact |
| IaC | committed IaC source plus one successful apply/log |
| Backups / restore | restore test notes with date, operator, source backup, result |
| Alerting | tested notification received in the real destination |
| Logging | proof of centralized log access, retention decision, and access control owner |
| Authz audit | reviewed route inventory with pass/fail notes and follow-up fixes |
| Runbooks | timestamped drill notes for release, rollback, rotation, and restore |

## Named control owners

Use these default owners unless the team assigns named individuals:

- `Platform`: Render, Cloudflare, domains, TLS, network exposure, IaC
- `AppSec`: authn/authz audit, secret handling, security tests, image signing policy
- `DevEx`: CI/CD workflows, release automation, branch protection, contributor guidance
- `Operations`: alerts, logging, backups, restore drills, incident readiness

## 0) Production readiness summary

### Strong baseline already present

- [x] GitHub Actions CI for backend and frontend lint, test, and build: `.github/workflows/ci.yml`
- [x] Secret scanning in CI with Gitleaks: `.github/workflows/secrets-scan.yml`
- [x] SAST with CodeQL: `.github/workflows/codeql.yml`
- [x] Dependency vulnerability scanning for backend, frontend, and blockchain: `.github/workflows/dependency-audit.yml`
- [x] CycloneDX SBOM generation for backend, frontend, and blockchain: `.github/workflows/sbom.yml`
- [x] Container image vulnerability scanning with Trivy: `.github/workflows/container-scan.yml`
- [x] Dependabot for npm and GitHub Actions: `.github/dependabot.yml`
- [x] Backend baseline HTTP hardening is present: Helmet, CORS allowlist logic, request IDs, rate limiting, mongo sanitize, XSS clean, HPP, structured logging: `backend/src/server.js`, `backend/middleware/*.js`
- [x] Non-root container runtime for backend and health checks for backend/frontend: `backend/Dockerfile`, `frontend/Dockerfile`
- [x] Monitoring, alerting, logging, release, rollback, secret rotation, and on-call runbooks exist: `docs/OBSERVABILITY_BASELINE.md`, `docs/LOGGING_STRATEGY.md`, `docs/RENDER_RELEASE_RUNBOOK.md`, `docs/SECRET_ROTATION_RUNBOOK.md`, `docs/ONCALL_GUIDE.md`
- [x] PR security checklist and threat-model template exist: `.github/pull_request_template.md`, `docs/THREAT_MODEL_TEMPLATE.md`

### Production blockers still open

- [~] CD workflows for staged promotion and deploy orchestration now exist in repo, but they are not yet proven in live environments
- [~] Registry publish workflow for signed, versioned images now exists in repo, but it is not yet exercised against production releases
- [~] Image signing and provenance attestation workflows now exist in repo, but deploy-time verification is not yet enforced
- [~] Infrastructure as Code now exists for Render and Cloudflare, but it is not yet fully applied or extended to datastores and alert destinations
- [ ] No verified backup policy plus restore-test evidence for production data stores
- [ ] No centralized hosted log export beyond Render/Cloudflare baseline
- [ ] No distributed tracing
- [~] Branch protection and required-check policy is now captured in `.github/settings.yml`, but enforcement still depends on GitHub-side application
- [x] Deployment docs are now aligned to the supported Render + Cloudflare path: `docs/DEPLOYMENT_GUIDE.md`

### Recommended release decision

- [~] Safe for controlled demo / supervised release candidate work
- [ ] Not yet ready for unattended production operation until Section 1 blockers are closed

## 0.1) Go / no-go scoring

Use this quick gate when deciding whether to approve first production launch:

- `Go`: every item in Section 7 is `[x]`
- `Conditional go`: only possible for a supervised pilot, never unattended production, and only if every Section 1 item is at least `[~]` with named owner and due date
- `No-go`: any Section 1 item remains `[ ]`

## 1) Must close before production

### 1.1 Release governance and protected delivery

- [~] Enforce branch protection on the release branch with required checks:
  - `CI`
  - `Secrets Scan`
  - `Dependency Audit`
  - `Container Scan`
  - `CodeQL`
- [~] Require at least one human reviewer for application, workflow, Docker, and docs changes affecting operations
- [ ] Restrict Render production deploy rights to a minimal operator group
- [ ] Restrict Cloudflare production change rights to a minimal operator group
- [x] Record the canonical release branch and deployment approval path in one place
- [ ] Record emergency break-glass access procedure and approval expectations

### 1.2 Automated CD and rollback

- [x] Add a GitHub Actions deployment workflow for `staging` and `production`
- [~] Require explicit promotion from `staging` to `production`
- [x] Publish immutable release identifiers for frontend and backend
- [x] Attach build artifacts or image digests to each release
- [~] Encode rollback steps into the deployment workflow or Render API automation instead of relying only on manual console actions
- [~] Manual rollback runbook exists today: `docs/RENDER_RELEASE_RUNBOOK.md`

### 1.3 Image publishing, signing, and provenance

- [x] Publish backend and frontend images to a production registry
- [x] Tag images with git SHA and release version
- [x] Sign production images with Cosign or equivalent
- [x] Generate provenance attestations for build outputs
- [ ] Verify signatures/attestations before or during deploy
- [x] Images are already built and scanned in CI using the production Dockerfiles: `.github/workflows/container-scan.yml`

### 1.4 Infrastructure as Code

- [x] Define Render services, env vars, health checks, and domains as code
- [x] Define Cloudflare DNS, TLS mode, proxy, and security settings as code
- [ ] Define monitoring/alert destination configuration as code where possible
- [ ] Define managed datastore provisioning approach as code or documented provider runbook
- [~] Architecture decision exists, and baseline provisioning artifacts are now in repo, but live provisioning is still manual: `docs/adr/ADR-0001-render-cloudflare-hosting.md`, `render.yaml`, `infra/cloudflare/`

### 1.5 Data protection, backups, and DR

- [ ] Decide and document the production MongoDB hosting provider
- [ ] Decide and document the production Redis hosting provider
- [x] Define backup retention, encryption, and access controls
- [x] Define backup frequency for MongoDB and Redis
- [ ] Run and record at least one restore test before launch
- [x] Write a short disaster recovery runbook with RTO/RPO targets
- [x] Backup and DR policy is now documented in `docs/BACKUP_AND_DR_POLICY.md`, but there is still no verified restore evidence
- [x] Ensure backups are stored outside the primary hosting failure domain

### 1.6 Logging and alert routing

- [ ] Configure a real external Alertmanager receiver config for production notifications
- [ ] Export Render logs to a dedicated log platform or SIEM
- [x] Define log retention expectations for production
- [x] Define who can access production logs containing sensitive operational metadata
- [x] Define how long security-relevant audit evidence must be retained
- [x] Alertmanager config supports external webhook routing: `monitoring/alertmanager.yml`
- [x] Monitoring drill automation exists: `scripts/run-monitoring-drill.mjs`
- [x] Render/Cloudflare-first logging strategy is documented: `docs/LOGGING_STRATEGY.md`

### 1.7 Documentation accuracy

- [x] Remove or clearly mark non-authoritative Kubernetes deployment examples in `docs/DEPLOYMENT_GUIDE.md`
- [x] Align all deployment docs to the actual supported production path: Render + Cloudflare
- [ ] Ensure every production doc names its owner and review cadence

## 2) CI/CD and software supply chain

### 2.1 CI foundations

- [x] Backend CI runs `npm ci`, lint, and tests: `.github/workflows/ci.yml`
- [x] Frontend CI runs `npm ci`, lint, tests, and build: `.github/workflows/ci.yml`
- [x] Node 18 is pinned in current workflows
- [x] Lockfiles are used in all Node subprojects
- [x] Reusable `workflow_call` templates are in place for backend and frontend CI
- [x] Add concurrency controls to cancel superseded runs on the same branch
- [x] Add artifact retention policy for security outputs and build outputs

### 2.2 Dependency security

- [x] Dependabot weekly updates for backend, frontend, blockchain, and GitHub Actions
- [x] `npm audit --omit=dev --audit-level=high` gates production dependency risk in CI
- [x] SBOMs are generated and uploaded as artifacts
- [x] Add container SBOM generation
- [ ] Define who triages vulnerability findings and expected SLA by severity

### 2.3 SAST, secrets, and security testing

- [x] CodeQL is enabled for JavaScript
- [x] Gitleaks scans the git history in CI
- [x] Security test expectations are documented in `docs/SECURITY_TEST_MATRIX.md`
- [ ] Add negative tests for privilege escalation and authorization boundary failures
- [ ] Add tests for secret-bearing logs and sensitive payload redaction if logging changes are made
- [ ] Add explicit tests for broken CORS configuration and unsafe wildcard regressions

### 2.4 Build reproducibility and release traceability

- [x] Docker builds use `npm ci`
- [x] Container scan builds use `linux/amd64`
- [x] Produce release notes automatically from merged changes
- [~] Store release metadata linking commit, SBOM, scan results, and image digest
- [x] Version backend/frontend releases consistently rather than only by commit state

## 3) Application security controls

### 3.1 HTTP and API hardening

- [x] Helmet is enabled
- [x] CORS is allowlist-based by default and blocks wildcard use unless explicitly enabled for demos
- [x] JSON and form body size limits are set to `10kb`
- [x] MongoDB injection mitigation is enabled
- [x] XSS sanitization middleware is enabled
- [x] HPP protection is enabled
- [x] Request IDs are attached and returned as `X-Request-Id`
- [x] Global API rate limiting is enabled
- [x] Auth route, IoT route, password reset, and API-key limiters exist in middleware
- [~] Review every route to ensure the stricter limiters are actually applied where intended

### 3.2 Authentication and authorization

- [x] JWT auth middleware exists
- [x] RBAC helpers exist: `restrictTo`, permission helpers, `requireMFA`
- [x] Frontend protected/role route guards exist
- [~] Security audit notes the backend must remain source of truth and recommends spot-checking route enforcement: `docs/security-audit.md`
- [x] Perform a route-by-route authorization audit and record results
- [~] Ensure high-risk write operations emit `AuditLog` entries consistently
- [~] Verify admin-only device and infrastructure-related routes are enforced on the backend
- [ ] Verify token invalidation behavior after password reset, account deactivation, and secret rotation

### 3.3 Secrets and configuration handling

- [x] Root and backend environment templates avoid shipping live secrets
- [x] Secret rotation runbook exists
- [x] Render-required env vars are documented
- [x] Build-time and runtime configuration are split and documented across current templates and deployment docs
- [x] Standardize variable naming between root `.env.example`, `backend/.env.example`, code, and docs
- [ ] Move production secrets to managed secret storage only; do not rely on operator-local files
- [ ] Define key-rotation procedure for any encrypted persisted data before rotating `ENCRYPTION_KEY`
- [ ] Ensure no real secrets exist in screenshots, sample payloads, or generated docs under `docs/`

### 3.4 Container runtime hardening

- [x] Backend runs as non-root user
- [x] Health checks exist for backend and frontend images
- [~] Images are Alpine-based and smaller than general-purpose bases, but not minimized to distroless or similarly locked-down runtime targets
- [ ] Add explicit read-only filesystem, dropped capabilities, and seccomp/apparmor posture where the target platform supports it
- [ ] Review whether backend needs local file-write access to `logs/` and `uploads/` in hosted production

## 4) Platform, network, and hosted environment controls

### 4.1 Render and Cloudflare baseline

- [x] Render + Cloudflare target architecture is documented
- [x] Cloudflare Full (strict) TLS guidance is documented
- [x] Public domains and CORS alignment guidance is documented
- [ ] Verify HSTS, WAF, bot protection, and rate limiting policies at Cloudflare
- [ ] Verify only frontend and API hostnames are public
- [ ] Verify MongoDB, Redis, admin, and monitoring endpoints are not internet-exposed

### 4.2 Environment separation

- [~] Define separate `dev`, `staging`, and `production` services/environments
- [ ] Prevent shared secrets between non-production and production
- [ ] Prevent production databases from being used by test/demo workloads
- [ ] Document dataset policy for staging and demos

### 4.3 Access control and auditability

- [x] Define least-privilege roles for GitHub, Render, Cloudflare, MongoDB, Redis, and alerting tools
- [ ] Require MFA on all operator/admin accounts
- [ ] Enable provider-side audit logging where available
- [ ] Document offboarding steps for operator access removal
- [x] Record who approves production access grants and how often access is reviewed

## 5) Monitoring, observability, and incident readiness

### 5.1 Metrics and dashboards

- [x] Backend exposes Prometheus metrics
- [x] Prometheus, Grafana, and alert rules are present under `monitoring/`
- [x] SLOs and minimum dashboard expectations are documented
- [x] Monitoring operations guide exists
- [x] Confirm hosted production actually scrapes `/metrics`
- [x] Confirm dashboards and alerts are deployed from version-controlled config in the chosen environment

### 5.2 Alerts and response

- [x] Severity model and first-response flow are documented
- [x] Alertmanager receiver config is version-controlled and mount-overridable through `ALERTMANAGER_CONFIG_PATH`
- [~] Alert routing exists in config, but production destination setup is not evidenced in repo
- [ ] Connect alerts to PagerDuty, Opsgenie, Slack webhook, or equivalent
- [x] Test at least one synthetic alert and capture evidence

### 5.3 Logs and tracing

- [x] Structured backend logging is implemented with Winston
- [x] Morgan request logging is wired through the logger
- [x] Request correlation via `X-Request-Id` is implemented
- [ ] Add explicit log redaction rules if structured payload logging grows
- [ ] Add tracing only after metrics/log workflows are consistently used
- [ ] Decide whether OpenTelemetry is needed for backend plus third-party integrations

### 5.4 Runbooks and game days

- [x] Release, rollback, secret rotation, on-call, logging, and alert docs exist
- [x] Render rollback drill automation exists: `scripts/run-render-rollback-drill.mjs`
- [x] Mongo logical backup and restore drill tooling exists: `backend/scripts/runBackupRestoreDrill.js`
- [x] Run at least one rollback drill against a live hosted environment
- [ ] Run at least one release drill and one rollback drill against a staging environment
- [ ] Run at least one secret-rotation exercise
- [ ] Run at least one backup restore exercise
- [ ] Record lessons learned from each drill and convert gaps into tracked backlog items

## 6) Developer workflow and governance

### 6.1 Golden path

- [x] The repo now provides one authoritative contributor golden path: `docs/CONTRIBUTOR_GOLDEN_PATH.md`
- [x] Document the preferred local workflow for backend, frontend, tests, monitoring, and demo data
- [x] Document required tool versions for contributors
- [ ] Document troubleshooting for the most common setup failures

### 6.2 Secure change management

- [x] PR template includes a security review checklist
- [x] Threat-model template exists
- [x] Document secure coding patterns for this repo:
  - auth middleware usage
  - role enforcement
  - request validation
  - logging do/don't rules
  - secret handling
  - external integration patterns
- [x] Define when security review is mandatory for changes touching auth, secrets, workflows, infra, or monitoring
- [x] Define who can approve workflow changes that impact deployment or security enforcement

### 6.3 AI-assisted engineering controls

- [x] Define which ops/config/doc changes AI can draft versus directly merge
- [x] Require deterministic verification for AI-generated workflow, Docker, secrets, or deployment changes
- [ ] Store reusable prompts/checklists only if they improve repeatability and review quality

## 7) Exit criteria for first real production launch

Do not mark CHENGETO production-ready until all of the following are true:

- [ ] Production branch protection and required checks are enforced
- [ ] Staging and production deployment workflows exist and are tested
- [ ] Production images are published, versioned, signed, and traceable to source commits
- [~] Render and Cloudflare configuration are managed reproducibly
- [ ] MongoDB and Redis backup/restore process is documented and proven
- [ ] External alert routing is connected and tested
- [x] Centralized log retention/access model is defined
- [x] Authorization audit of backend routes is completed
- [x] Deployment docs no longer advertise unsupported Kubernetes assets as if they are real
- [ ] One release drill, one rollback drill, one restore drill, and one secret rotation drill have been completed

## 8) Recommended execution order

1. [ ] Close documentation accuracy gaps, especially unsupported Kubernetes guidance
2. [ ] Enforce branch protection and required checks
3. [ ] Add staging/production CD with immutable versioning and rollback support
4. [ ] Publish and sign production images with provenance
5. [ ] Define IaC for Render and Cloudflare
6. [ ] Finalize datastore backup, restore, and DR controls
7. [ ] Connect real alert routing and external log aggregation
8. [ ] Complete backend authorization/audit-log review and security test expansion
9. [ ] Run production-readiness drills and record evidence

## 9) Production cutover checklist

Use this only after Sections 1 and 7 are complete.

### T-14 to T-7 days

- [ ] Freeze scope for infrastructure, auth, and deployment-path changes unless explicitly approved
- [ ] Confirm provider accounts, MFA, and least-privilege access
- [ ] Confirm staging deploy path, rollback path, and monitoring visibility
- [ ] Complete authz audit and close critical findings
- [ ] Complete restore drill and secret rotation drill

### T-7 to T-1 days

- [ ] Publish the exact backend/frontend versions intended for production
- [ ] Verify signatures, digests, and deployment metadata
- [ ] Reconfirm CORS allowlists, Cloudflare DNS, TLS mode, and origin mappings
- [ ] Verify alert delivery into the real paging/notification channel
- [ ] Confirm backup jobs and log retention are active

### Launch day

- [ ] Deploy backend using the approved release workflow
- [ ] Verify backend health, logs, metrics, and alert silence
- [ ] Deploy frontend using the approved release workflow
- [ ] Verify login, protected routes, real-time features, and user-critical flows
- [ ] Record release version, operator, time window, and any deviations

### T+1 day

- [ ] Review logs, alerts, error rate, and latency trends
- [ ] Confirm no unexpected access, auth, or data-integrity issues
- [ ] Convert any launch-day issues into tracked follow-up work
