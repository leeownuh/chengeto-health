# CHENGETO Operations Drill Status

Last updated: 2026-06-07

## Completed drills

### Monitoring drill

- Date: 2026-06-07
- Tooling: `scripts/run-monitoring-drill.mjs`
- Target: hosted backend `chengeto-health.onrender.com`
- Result: pass
- Evidence:
  - Prometheus successfully scraped the hosted `/metrics` endpoint
  - synthetic alert `ChengetoSyntheticDrill` fired in Prometheus
  - Alertmanager received and routed the alert
  - webhook delivery was captured locally
  - screenshots were generated through the Grafana/Prometheus drill flow
- Output directory:
  - `outputs/drills/monitoring-2026-06-07T14-41-30-190Z`

### Render rollback drill

- Date: 2026-06-07
- Tooling: `scripts/run-render-rollback-drill.mjs`
- Service: Render backend
- Result: pass
- Evidence:
  - rollback from deploy `dep-d8iiodc2m8qs7391in40` to `dep-d8iibstckfvc73brovk0`
  - health check remained `200` after rollback
  - forward restore to commit `5b3bb9bdfc5371ca2cd3965b6b34b9c4f57aadb4`
  - health check remained `200` after restore
- Output directory:
  - `outputs/drills/rollback-2026-06-07T14-48-22-204Z`

## Partially completed drills

### Mongo backup / restore drill

- Date: 2026-06-07
- Tooling: `backend/scripts/runBackupRestoreDrill.js`
- Status: tooling complete, live drill blocked from this workstation
- Blocker:
  - Atlas connectivity from this machine failed during the restore drill path, so live evidence was not completed here
- Next action:
  - run the drill from a network path explicitly allowed by the managed MongoDB provider, or through a trusted runner with the required Atlas access

## Remaining evidence gaps

- external production alert destination proof
- release drill evidence
- secret rotation drill evidence
- live Mongo restore drill evidence
