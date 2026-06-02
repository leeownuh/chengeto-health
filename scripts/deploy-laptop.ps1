param(
  [switch]$Build
)

$ErrorActionPreference = "Stop"

Write-Host "CHENGETO laptop deployment (Docker Compose)" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  Write-Host "Missing .env. Copy .env.example to .env and set secrets first." -ForegroundColor Yellow
  exit 1
}

$composeFiles = @(
  "-f", "docker-compose.yml",
  "-f", "docker-compose.prod.yml",
  "-f", "docker-compose.laptop.yml"
)

if ($Build) {
  docker compose @composeFiles build
}

docker compose @composeFiles up -d
docker compose @composeFiles ps

Write-Host ""
Write-Host "Frontend (public site + app): http://localhost:8080/" -ForegroundColor Green
Write-Host "API health: http://localhost:5000/health" -ForegroundColor Green

