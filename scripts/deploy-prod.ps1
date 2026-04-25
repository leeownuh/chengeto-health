param(
  [switch]$Build
)

$ErrorActionPreference = "Stop"

Write-Host "CHENGETO production compose bring-up" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  Write-Host "Missing .env. Copy .env.example to .env and set secrets first." -ForegroundColor Yellow
  exit 1
}

if ($Build) {
  docker compose -f docker-compose.yml -f docker-compose.prod.yml build
}

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

Write-Host ""
Write-Host "Frontend: http://localhost/" -ForegroundColor Green
Write-Host "API health: http://localhost:5000/health" -ForegroundColor Green
