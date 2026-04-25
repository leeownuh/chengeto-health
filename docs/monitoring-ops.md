# Monitoring & Ops

This repo ships a basic Prometheus + Grafana setup under the `monitoring` compose profile.

## Start

```bash
docker compose --profile monitoring up -d prometheus grafana
```

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (default user/pass comes from `docker-compose.yml`)

## What’s Scraped

- Backend metrics: `http://backend:5000/metrics` (Prometheus job: `chengeto-backend`)
- Prometheus self-metrics: `prometheus`

## Alerts

Alert rules live in `monitoring/alert.rules.yml` and are mounted into the Prometheus container.

Included alerts:
- `ChengetoBackendDown` (backend not scrapeable)
- `ChengetoHigh5xxRate` (>5% 5xx over 5 minutes)

Note: Alertmanager isn’t configured yet (Prometheus UI still shows alert state).

## Dashboards

Grafana dashboards and datasources are provisioned from:
- `monitoring/grafana/datasources/datasources.yml`
- `monitoring/grafana/dashboards/dashboard.yml`
- `monitoring/grafana/dashboards/json/chengeto-overview.json`

## Suggested SLOs (Course-Friendly Defaults)

Pick one set and document it in your report:

- **API availability**: 99% monthly (`/health` and `/metrics` scrapeable)
- **API error budget**: <1% 5xx over 5 minutes during demos
- **P95 latency**: <500ms for non-file endpoints (derive from `http_request_duration_seconds`)

## Runbook (Minimal)

- Backend down: check `docker compose logs backend --tail 200`
- Metrics missing: confirm `/metrics` returns text and Prometheus target is `UP`
- Grafana empty: confirm datasource is Prometheus and dashboard provisioned

