# CHENGETO CI Security Workflows

This document explains the security-oriented GitHub Actions workflows and how they relate to the current Render deployment model.

## Workflows

### Dependency audit

- File: `.github/workflows/dependency-audit.yml`
- Scope: `backend`, `frontend`, `blockchain`
- Behavior: runs `npm ci` and then `npm audit --omit=dev --audit-level=high`
- Effect: fails CI when production dependencies contain High or Critical vulnerabilities

### SBOM generation

- File: `.github/workflows/sbom.yml`
- Scope: `backend`, `frontend`, `blockchain`
- Behavior: generates CycloneDX SBOM JSON files and uploads them as workflow artifacts
- Effect: provides a bill of materials for software supply-chain tracking

### Container scan

- File: `.github/workflows/container-scan.yml`
- Scope: `backend` and `frontend` Docker images
- Behavior: builds images from the same Dockerfiles used by hosted builds, then scans them with Trivy
- Effect: fails CI on High or Critical image vulnerabilities and uploads SARIF results to GitHub security tooling

## Render alignment

The container scan is intentionally close to how Render builds this repo today:

- `backend/Dockerfile` is built directly for scan jobs
- `frontend/Dockerfile` is built directly for scan jobs
- scan builds use `linux/amd64`, which is a closer match to hosted Linux deployment targets
- frontend scan builds pass placeholder `VITE_API_URL` and `VITE_SOCKET_URL` build args so the image can build without production secrets

## Notes

- These workflows are CI checks; they do not deploy anything to Render
- Render runtime secrets still need to be managed in the Render dashboard or via Render IaC/API later
- SBOMs are uploaded as artifacts now; publishing or attesting them can be added later
