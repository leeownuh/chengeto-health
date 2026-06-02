# CHENGETO Log Retention Policy

## Application logs

- Centralize backend logs from Render into the chosen log platform or SIEM.
- Retain searchable application logs for at least 30 days.
- Retain security-relevant incident evidence and audit extracts for at least 90 days.

## Audit evidence

- Preserve release records, rollback notes, secret rotations, restore drill notes, and alert test evidence for at least 12 months.

## Access

- Read access: on-call, operations, and platform engineers with legitimate operational need
- Administrative retention changes: operations lead only

## Redaction requirements

- Do not retain secrets, raw passwords, raw tokens, or full credential payloads.
- If sensitive health data appears in logs, treat it as an incident and remove the source logging behavior.
