# CHENGETO Render Log Export Notes

This note documents the next step for moving beyond Render-only logs.

## Current baseline

- Render logs are the primary central application log stream
- Cloudflare provides edge visibility
- `X-Request-Id` is available for request correlation

## When to export logs

Export logs when one or more of these becomes true:

- incidents require searching across long time windows
- multiple operators need shared searchable history
- you need dashboards or alerts from logs
- compliance or audit needs longer retention than Render provides comfortably

## Good options

- Better Stack / Logtail
- Grafana Loki
- OpenSearch / ELK
- Datadog Logs

## Minimum requirements for any log platform

- searchable `X-Request-Id`
- retention policy
- filtering by service and severity
- easy export of incident evidence

## Chengeto recommendation

For the current stage, keep Render logs as the primary source of truth and plan the first export integration only when incident volume or retention needs justify it.
