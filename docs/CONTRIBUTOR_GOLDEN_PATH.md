# CHENGETO Contributor Golden Path

Use this as the default contributor workflow.

## Tooling

- Node.js 18.x
- npm 9+
- Docker Desktop 24+
- Docker Compose 2.20+

## First-time setup

1. Copy `.env.example` to `.env`.
2. Copy `backend/.env.example` if you need manual backend startup.
3. Install dependencies in `backend/`, `frontend/`, and `blockchain/` with `npm ci --legacy-peer-deps`.

## Daily workflow

### Preferred full-stack path

```bash
docker compose up -d
```

### Backend-only path

```bash
cd backend
npm run dev
```

### Frontend-only path

```bash
cd frontend
npm run dev
```

## Verification before opening a PR

### Backend

```bash
cd backend
npm run lint
npm test
```

### Frontend

```bash
cd frontend
npm run lint
npm test -- --run
npm run build
```

## Security-sensitive changes

For changes touching auth, secrets, workflows, Dockerfiles, `render.yaml`, or `infra/`, review:

- `docs/SECURE_CODING_PATTERNS.md`
- `docs/THREAT_MODEL_TEMPLATE.md`
- `.github/pull_request_template.md`
