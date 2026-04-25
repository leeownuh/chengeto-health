#!/usr/bin/env sh
set -eu

echo "CHENGETO production compose bring-up"

if [ ! -f ".env" ]; then
  echo "Missing .env. Copy .env.example to .env and set secrets first."
  exit 1
fi

if [ "${1:-}" = "--build" ]; then
  docker compose -f docker-compose.yml -f docker-compose.prod.yml build
fi

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo ""
echo "Frontend: http://localhost/"
echo "API health: http://localhost:5000/health"
