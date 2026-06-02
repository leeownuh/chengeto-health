# ADR-0001: Render and Cloudflare as the current production baseline

- status: accepted
- date: 2026-05-22
- owners: DevEx / DevSecOps

## Context

CHENGETO needs a low-ops, low-cost production baseline that can host the frontend and backend publicly while keeping operational complexity manageable for a small team.

The team is already using:

- Render for hosted application services
- Cloudflare for DNS and edge proxying
- GitHub Actions for CI security checks

The team does not want to introduce Kubernetes, self-managed infrastructure, or a higher-cost observability platform by default.

## Decision

Use the following as the current production baseline:

- Render hosts the frontend and backend services
- Cloudflare fronts the public frontend and API domains
- GitHub Actions remains the CI and security-check system
- Render logs remain the primary production log source for now
- Prometheus, Grafana, and Alertmanager in this repo remain the local validation and operator reference stack

## Consequences

Benefits:

- lower operational complexity
- lower cost
- simpler release and rollback flow
- easier onboarding for a small team

Tradeoffs:

- no full Infrastructure as Code baseline yet
- limited built-in long-term log retention compared with a dedicated log platform
- alert delivery and advanced observability still depend on follow-up integrations

Deferred work:

- centralized log export
- distributed tracing
- image signing and provenance
- staged deployment promotion

## Alternatives considered

- self-hosted VM stack:
  - rejected because it adds more operational burden and security responsibility
- Kubernetes:
  - rejected because it is too heavy for the current budget and team size
- Azure-first managed platform:
  - rejected for now because the current priority is low spend and low ops overhead

