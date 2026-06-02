# CHENGETO Alert Integrations

This document explains how to wire CHENGETO alerts into a real notification destination.

## Local monitoring stack

The local monitoring profile uses Alertmanager and reads the destination from:

- `ALERTMANAGER_DEFAULT_WEBHOOK_URL`

Set it in `.env` before starting the monitoring profile:

```bash
ALERTMANAGER_DEFAULT_WEBHOOK_URL=https://your-webhook-endpoint.example/alerts
```

Then start the stack:

```bash
docker compose --profile monitoring up -d prometheus alertmanager grafana
```

## Supported integration patterns

Use a webhook destination that forwards into one of these systems:

- Slack incoming-webhook relay
- Microsoft Teams webhook relay
- PagerDuty Events API relay
- Better Stack incident webhook
- a small internal webhook receiver that fans out to email/chat/on-call tools

## Recommendation for CHENGETO

For the current size and stack, the simplest path is:

1. send Alertmanager to a small webhook receiver
2. relay into Slack or Teams
3. add PagerDuty later if on-call load grows

This keeps provider-specific formatting outside the repo and makes later changes easier.

## Production note

The local Docker monitoring stack is for development and validation. Render production alerting will usually be handled by:

- Render service health and deploy notifications
- Cloudflare notifications for edge or DNS problems
- any external monitoring platform you adopt for metrics and alert delivery

## Verification

After setting the webhook URL:

1. start Alertmanager
2. confirm Prometheus shows an active alert
3. confirm Alertmanager lists the alert
4. confirm the webhook destination receives it
