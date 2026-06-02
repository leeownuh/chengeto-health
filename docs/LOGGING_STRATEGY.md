# CHENGETO Logging Strategy

This document defines the practical logging approach for CHENGETO in the current Render and Cloudflare deployment model.

## Current state

- Backend logs are produced with Winston in `backend/config/logger.js`
- HTTP request logs are emitted through Morgan in `backend/src/server.js`
- Each request now carries an `X-Request-Id` header for correlation
- Local Docker monitoring can inspect logs directly from containers

## Production logging approach

For the current hosted setup, use Render as the central log collection point first.

- Treat Render service logs as the primary aggregated application log stream
- Use Cloudflare analytics and events for edge-level visibility
- Use `X-Request-Id` to connect browser issues, API logs, and incident notes

## Minimum logging rules

- Keep structured logs enabled in production
- Log health, errors, auth failures, blocked CORS requests, and deploy-impacting failures
- Never log secrets, tokens, passwords, or full credential payloads
- Prefer metadata fields over free-form text where possible

## Investigation workflow

1. Start from the user-facing symptom and time window.
2. Check the relevant Render service logs.
3. Search by `X-Request-Id` if available.
4. Cross-check with Prometheus alerts and Grafana metrics.
5. If the issue is edge-related, inspect Cloudflare events/config changes.

## Next logging maturity step

The next improvement after this baseline is to export logs from Render into a dedicated system such as:

- Grafana Loki
- ELK / OpenSearch
- Better Stack / Logtail
- Datadog Logs

When that happens, preserve `X-Request-Id` as a first-class searchable field.
