# Infrastructure as Code

This repository now carries the production infrastructure definitions that belong in source control:

- `render.yaml`
  Render Blueprint baseline for backend and frontend services.
- `infra/cloudflare/`
  Terraform for public DNS and Cloudflare zone settings.

Provider resources that are still managed outside the repository must be captured in runbooks and evidence notes until they are also codified.
