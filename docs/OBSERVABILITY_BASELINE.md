# CHENGETO Observability Baseline

This document defines the initial observability expectations for CHENGETO in hosted production environments.

## Service Level Objectives

### Backend API

- Availability SLO: `99.5%` monthly for `/health` and core authenticated API endpoints
- Error SLO: `<= 1%` 5xx rate over a rolling 30-day period
- Latency SLO: `p95 < 750ms` for standard API requests, excluding large uploads

### Frontend

- Availability SLO: public site and app shell reachable through Cloudflare
- Error SLO: no sustained frontend runtime crash on core routes

## Alert ownership

- `critical`: respond immediately and consider rollback
- `high`: investigate within the same operating window
- backend availability alerts are owned by the backend/operator on release duty
- frontend outage symptoms observed through Cloudflare are owned by the release operator first, then narrowed to frontend/backend/config

## Logging expectations

- Keep structured backend logs enabled in production
- Preserve `X-Request-Id` from client to backend when present
- Record `X-Request-Id` in incident notes for user-visible failures
- Do not log secrets, tokens, raw passwords, or full credential payloads

## Metrics expectations

- Prometheus must scrape the backend `/metrics` endpoint successfully
- Grafana must show backend health, request volume, error rate, and request latency
- Release decisions should consider health checks plus recent error-rate trends

## Tracing roadmap

CHENGETO does not yet implement distributed tracing. The next practical tracing step is:

1. keep `X-Request-Id` end-to-end
2. add the request ID to structured application logs
3. add OpenTelemetry only after logs and metrics are consistently used

## Minimum production dashboard set

- Backend availability and uptime
- HTTP request rate
- HTTP 5xx rate
- HTTP p95 latency
- Active alerts
- Check-ins today

## Incident evidence checklist

- Time window
- affected service (`frontend`, `backend`, or `Cloudflare/config`)
- relevant `X-Request-Id` if available
- screenshot or log extract
- deploy version before and after rollback if a release caused the issue
