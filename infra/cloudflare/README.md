# Cloudflare IaC

This directory contains Terraform scaffolding for the CHENGETO Cloudflare zone.

## Expected use

1. Install Terraform or OpenTofu.
2. Create `terraform.tfvars` from `terraform.tfvars.example`.
3. Supply a Cloudflare API token with the permissions required to manage DNS and zone settings.
4. Run `terraform init`, `terraform plan`, and `terraform apply`.

## Managed controls

- frontend and API DNS records
- HTTPS enforcement
- minimum TLS version
- security level
- browser integrity check
- automatic HTTPS rewrites
- HSTS
- bot fight mode toggle

## Not managed here

- provider account membership and MFA enforcement
- notifications configuration
- plan-limited settings not available on the selected Cloudflare plan

Review plan output carefully before apply because some zone settings are plan-dependent.
