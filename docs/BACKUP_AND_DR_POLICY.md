# CHENGETO Backup and DR Policy

Last updated: 2026-06-02

## Scope

- managed MongoDB
- managed Redis
- production configuration evidence
- release metadata, SBOMs, and provenance artifacts

## Backup policy

- MongoDB backups: daily automated snapshots plus point-in-time recovery if supported by the provider
- Redis backups: daily snapshots if Redis is used for durable state; otherwise document cache-only use and rebuild expectations
- Retention: 30 days minimum for daily backups, 90 days for monthly restore evidence
- Storage location: backup copies must exist outside the primary hosting failure domain
- Encryption: provider-managed encryption at rest plus TLS in transit

## Restore testing

- Run one restore drill before first production launch
- Run restore drills at least quarterly
- Record date, operator, backup source, target environment, result, and follow-up actions

## Repo-backed logical backup drill

For MongoDB environments where provider snapshot access is not exposed directly in this repo workflow, CHENGETO also supports a logical export/restore drill:

```bash
cd backend
npm run backup:db -- --out-dir ../outputs/backups/manual
npm run drill:restore
```

The restore drill:

- exports the live source database into EJSON files
- restores into a separate target database
- validates collection counts against the backup manifest
- optionally drops the temporary restore target after validation

This does not replace provider-managed snapshots, but it does provide repeatable restore evidence at the application data layer.

## RTO / RPO targets

- Target RTO: 4 hours
- Target RPO: 24 hours

## Disaster recovery flow

1. Assess whether the incident is application, data, or provider failure.
2. Freeze further production writes if data integrity is at risk.
3. Restore the most recent verified backup into a safe recovery environment first.
4. Validate core clinical and user data before cutover.
5. Repoint application configuration only after validation.
6. Record incident timeline and post-incident actions.
