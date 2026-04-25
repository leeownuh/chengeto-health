# UI Snapshots (Screenshots + State)

This project is role-driven. For stakeholder reviews you may need a deterministic set of screenshots **for every route** plus a machine-readable record of the visible state.

## Prerequisites

- Bring the stack up:
  - For offline/PWA evidence, use the production preview (service worker enabled):
    - `docker compose --profile pwa up -d --build mongodb redis blockchain backend frontend-prod`
- Seed demo data (recommended):
  - `cd backend; node scripts/seedDatabase.js`
- Ensure the frontend is reachable at `http://127.0.0.1:80/` and the API at `http://127.0.0.1:5000/health`.

## Install screenshot tooling (Playwright)

From `frontend/`:

- Install Playwright:
  - `& 'C:\Program Files\nodejs\npm.cmd' install -D playwright`
- If you do not want Playwright to download browsers, set:
  - `setx PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD 1`
  - (Then Playwright will use the system browser if available.)

## Capture

Run:

- `node frontend/scripts/capture-ui-snapshots.mjs --baseUrl http://127.0.0.1:80 --backendPort 5000`

Outputs:

- `docs/ui-snapshots/<timestamp>/snapshot.md` (index of screenshots)
- `docs/ui-snapshots/<timestamp>/snapshot.json` (URLs + extracted headings/alerts/offline banner)
- `docs/ui-snapshots/<timestamp>/*.png` (screenshots)
- `docs/ui-snapshots/latest/` (a copy of the most recent snapshot run)

Notes:

- Offline proof: the script also captures offline screenshots for `/checkin`, `/patients`, `/alerts`, and `/schedule`.
- IoT proof: for `admin` + `chw` it publishes a panic alert from `/iot/simulator` and captures `/alerts` again (`*_alerts_after_iot.png`).
- Schedule proof: the script forces the Schedule page into **DAY** view and auto-populates “today” appointments (tagged `[seeded]`) so the day is visibly populated in screenshots.

## Demo accounts

The snapshot script logs in using the seeded demo accounts from `backend/scripts/seedDatabase.js`:

- `admin@chengeto.health`
- `chw1@chengeto.health`
- `caregiver1@example.com`
- `clinician1@chengeto.health`
- `family1@example.com`

Password:

- `Demo@123456` (or `DEMO_PASSWORD` if set)
