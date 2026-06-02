# CHENGETO Laptop Deployment (No Cloud)

This guide runs CHENGETO on a single laptop using Docker Compose. It’s the lowest-cost option and good for demos/pilots.

## 1) Prerequisites

- Windows + Docker Desktop installed and running
- Ports available: `8080` (frontend), `5000` (backend)

## 2) Configure environment

From repo root:

```powershell
Copy-Item .env.example .env
notepad .env
```

Minimum: set strong values for:

- `MONGO_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `ENCRYPTION_KEY`
- `CORS_ORIGIN` (for laptop use: `http://localhost:8080`)

## 3) Start (recommended)

```powershell
.\scripts\deploy-laptop.ps1 -Build
```

Open:

- Frontend: `http://localhost:8080/`
- API health: `http://localhost:5000/health`

## 4) Stop

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.laptop.yml down
```

## 5) Backups (basic)

### MongoDB dump to a local folder

```powershell
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path ".\\backups\\$ts" | Out-Null
docker exec chengeto-mongodb mongodump --username admin --password $env:MONGO_PASSWORD --authenticationDatabase admin --db chengeto_health --out /tmp/backup
docker cp chengeto-mongodb:/tmp/backup ".\\backups\\$ts\\mongodb"
```

## 6) Important limitations (single laptop)

- If the laptop sleeps/offlines, the service is down.
- If the disk fails and you have no off-laptop backups, you lose data.
- For public internet access, you must add TLS + safe exposure (don’t just port-forward without hardening).

