# CHENGETO GitHub Environment Setup

Use this runbook to finish the repository-side controls that cannot be enforced from source code alone.

## Required environments

- `staging`
- `production`

## Environment protection rules

### `staging`

- optional reviewer approval
- environment secrets for staging deploy hooks
- environment variables for staging health checks

### `production`

- required reviewer approval
- deployment branch restriction to `main`
- environment secrets for production deploy hooks
- environment variables for production health checks

## Required repository secrets

- `RENDER_BACKEND_DEPLOY_HOOK_URL`
- `RENDER_FRONTEND_DEPLOY_HOOK_URL`

If staging and production use different hooks, store them in environment-scoped secrets rather than repository-wide secrets.

## Required environment variables

- `BACKEND_HEALTHCHECK_URL`
- `FRONTEND_HEALTHCHECK_URL`
- `VITE_API_URL` for image-release workflow if using environment-scoped values
- `VITE_SOCKET_URL` for image-release workflow if using environment-scoped values

## Branch protection

Apply `.github/settings.yml` using the GitHub Settings app or manually mirror its rules in the repository settings UI.

## Evidence to capture

- screenshot/export of environment rules
- screenshot/export of branch protection
- one successful staging deployment run
- one successful production deployment run
