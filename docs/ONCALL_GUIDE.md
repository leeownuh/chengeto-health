# CHENGETO On-Call and Alert Guide

This guide defines the minimum response model for alerts and production issues.

## Severity

### Critical

- backend down
- login unavailable
- public site unavailable
- widespread 5xx errors after deploy

Action:

1. verify impact quickly
2. roll back if the issue started with a recent release
3. capture evidence and notify the team

### High

- elevated 5xx rate without full outage
- degraded latency
- partial feature failure

Action:

1. investigate in the same operating window
2. decide whether rollback is safer than forward-fix

## First response checklist

1. Check the latest deploys in Render.
2. Check GitHub Actions status for the release commit.
3. Check Prometheus target health and active alerts.
4. Check backend logs for the relevant time window.
5. Use `X-Request-Id` where available to narrow request-specific failures.
6. Decide between rollback, config revert, or forward-fix.

## Escalation guidance

- If the issue follows a deploy, page the release operator first
- If the issue is domain, TLS, or proxy related, check Cloudflare changes before changing app code
- If the issue is auth/session related, review recent secret or env var changes

## Exit criteria

- service is healthy again
- minimum release checks pass
- rollback or fix is recorded
- follow-up action is added to the DevSecOps checklist if process gaps were involved
