# CHENGETO Deployment Guide

This guide covers the supported deployment paths for CHENGETO as of 2026-06-02.

## Supported deployment models

### Production

- Render Blueprint defined in `render.yaml`
- Cloudflare DNS and TLS controls managed from `infra/cloudflare/`
- Managed MongoDB and Redis provided outside this repository

### Local and rehearsal environments

- Docker Compose: `docker-compose.yml`, `docker-compose.prod.yml`
- Manual backend/frontend startup for development only

## Unsupported deployment paths

The repository does not ship Kubernetes manifests, Helm charts, or Terraform for Kubernetes resources. Do not treat older Kubernetes examples from prior drafts as authoritative production guidance.

## Production deployment source of truth

Use these files and runbooks together:

- `render.yaml`
- `infra/cloudflare/`
- `docs/RENDER_DEPLOYMENT.md`
- `docs/RENDER_RELEASE_RUNBOOK.md`
- `docs/SECRET_ROTATION_RUNBOOK.md`
- `docs/BACKUP_AND_DR_POLICY.md`
- `docs/LOG_RETENTION_POLICY.md`
- `docs/ALERT_INTEGRATIONS.md`

## Local Docker deployment

### Build and start

```bash
docker compose up -d
```

### Production-like local stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Health checks

```bash
curl http://localhost:5000/health
curl http://localhost/
docker compose ps
```

## Manual development startup

### Backend

```bash
cd backend
npm ci --legacy-peer-deps
npm run dev
```

### Frontend

```bash
cd frontend
npm ci --legacy-peer-deps
npm run dev
```

## Production prerequisites

- GitHub Actions checks are green
- Render environment secrets are present
- Cloudflare DNS records match the intended frontend and API origins
- Backup and restore process has been tested
- Alert routing is connected and validated
- Rollback path is confirmed in `docs/RENDER_RELEASE_RUNBOOK.md`

## Production deployment flow

1. Merge reviewed changes to the protected release branch.
2. Publish versioned images via `.github/workflows/release-images.yml`.
3. Trigger `.github/workflows/deploy-render.yml` for `staging`.
4. Verify staging health, logs, dashboards, and critical user flows.
5. Promote to `production` via the same workflow with environment approval.
6. Record deploy evidence in the release note and operations log.

## Rollback

Follow `docs/RENDER_RELEASE_RUNBOOK.md`. If the issue is domain or TLS related, revert the Cloudflare change before redeploying application code.
