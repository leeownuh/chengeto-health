# Monitoring and Ops

This repo ships a basic Prometheus and Grafana setup under the `monitoring` compose profile. This document turns that setup into an operating baseline for CHENGETO.

## Start

```bash
docker compose --profile monitoring up -d prometheus alertmanager grafana
```

- Prometheus: `http://localhost:9090`
- Alertmanager: `http://localhost:9093`
- Grafana: `http://localhost:3000`

## Current telemetry

- Backend metrics: `http://backend:5000/metrics`
- Prometheus self-metrics: `prometheus`
- HTTP request count and latency from `backend/src/metrics.js`
- App gauges for patients, alerts, check-ins, devices, and users
- Structured backend logs from Winston in `backend/config/logger.js`
- Per-request correlation via `X-Request-Id` in `backend/src/server.js`

## Current alerts

Alert rules live in `monitoring/alert.rules.yml`.

- `ChengetoBackendDown`: backend is not scrapeable for 2 minutes
- `ChengetoHigh5xxRate`: backend 5xx ratio is greater than 5 percent for 5 minutes

Alertmanager config lives in `monitoring/alertmanager.yml`.

- Prometheus sends alerts to `alertmanager:9093`
- the default receiver reads `ALERTMANAGER_DEFAULT_WEBHOOK_URL` from the environment
- set a real Slack, Teams, PagerDuty relay, or webhook target before relying on notifications

## Operator baseline

- Use Grafana for dashboards and trend checks
- Use Prometheus for alert state and target health
- Use Alertmanager to confirm alert routing and notification grouping
- Use backend logs for incident details and request-level investigation
- Include `X-Request-Id` in incident notes when a single failing request is being traced

See also:

- `docs/ALERT_INTEGRATIONS.md`
- `docs/LOGGING_STRATEGY.md`
- `docs/RENDER_LOG_EXPORT_NOTES.md`
- `docs/RENDER_ALERTING_BASELINE.md`
