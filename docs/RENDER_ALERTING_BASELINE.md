# CHENGETO Render-Only Alerting Baseline

This document defines the low-cost production alerting path when CHENGETO stays on Render and Cloudflare without an external observability platform.

## Production alert sources

Use these sources first:

- Render service health and deploy notifications
- Cloudflare notifications for DNS, TLS, and edge-level issues
- CHENGETO backend health endpoint and production logs

## What should alert immediately

- backend service down
- frontend service unavailable through Cloudflare
- failed production deploy
- login unavailable
- repeated 5xx errors after release

## Operational approach

- treat Render service notifications as the first production alert channel
- use Cloudflare notifications for proxy, TLS, or domain-related failures
- use the local Prometheus and Alertmanager stack for validation, dashboards, and operator rehearsal

## Minimum setup expectations

- enable Render notifications for deploy failures and health issues
- enable Cloudflare notifications relevant to uptime, TLS, and domain health
- keep `docs/RENDER_RELEASE_RUNBOOK.md` and `docs/ONCALL_GUIDE.md` as the response path

## When to outgrow this baseline

Move beyond the Render-only baseline when:

- incidents need automatic paging
- multiple operators need shared alert history
- alert noise needs grouping and deduplication across production systems
- service reliability goals require alerting beyond deploy and uptime failures
