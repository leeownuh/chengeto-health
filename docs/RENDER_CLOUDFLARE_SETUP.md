# CHENGETO Render and Cloudflare Setup

This runbook converts the repo-managed templates into live provider configuration.

## Render

1. Create or sync services from `render.yaml`.
2. Configure service secrets:
   - `MONGODB_URI`
   - `REDIS_URL`
   - `JWT_SECRET`
   - `REFRESH_TOKEN_SECRET`
   - `ENCRYPTION_KEY`
   - `CORS_ORIGIN`
   - `ALERTMANAGER_DEFAULT_WEBHOOK_URL`
3. Copy the deploy hook URLs into GitHub environment secrets.
4. Confirm health checks:
   - backend: `/health`
   - frontend: `/`

## Cloudflare

1. Fill `infra/cloudflare/terraform.tfvars`.
2. Run `terraform init`.
3. Run `terraform plan`.
4. Review DNS changes and security settings.
5. Run `terraform apply`.
6. Confirm:
   - proxied frontend hostname
   - proxied API hostname
   - Full strict TLS
   - HTTPS redirect enabled
   - minimum TLS 1.2
   - HSTS enabled if supported by plan

## Validation

- frontend loads through Cloudflare
- API health check passes through public hostname
- CORS origins match served domains
- GitHub deploy workflow can reach the public health checks
