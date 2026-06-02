# CHENGETO Access Control Matrix

This matrix defines the minimum access model expected for production operations.

## GitHub

- `Read`: all contributors
- `Write`: maintainers only
- `Admin`: repository owner or designated platform lead
- `Required`: MFA, protected branch, required checks, reviewer requirement

## Render

- `Viewer`: engineers who need logs and deploy visibility
- `Operator`: release duty engineers who can deploy and roll back
- `Admin`: limited platform owners only
- `Required`: MFA, separate staging and production environments, deploy approvals via GitHub environment gates

## Cloudflare

- `DNS/TLS operator`: limited platform owners only
- `Read-only`: on-call engineers if the plan supports it
- `Required`: MFA, API tokens with least privilege, changes captured via Terraform in `infra/cloudflare/`

## Datastores

- `Application access`: app connection strings only
- `Human admin access`: minimal DB operators only
- `Required`: no shared admin credentials, backup/restore access separated from app runtime access

## Alerting and logging

- `Read`: on-call and platform
- `Manage routes/retention`: operations lead only
- `Required`: access review at least quarterly
