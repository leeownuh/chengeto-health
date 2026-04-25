# Verification Notes

## F0 - Stabilize Current Product Surface

Date: 2026-04-23

- Frontend: Open `http://127.0.0.1/schedule` and confirm it loads without demo fallback data when the API is unavailable (shows empty state + error snackbar).
- Frontend: Open `http://127.0.0.1/checkin/history` and confirm it loads from the API only (no demo records are injected on failure).
- Frontend: Open `http://127.0.0.1/profile` and confirm it uses API data; on API failure it falls back to the signed-in user identity only (no demo profile/stats/activity).
- Backend: Run `cd backend; npm test` and confirm `Schedules API` test passes.

## Phase 8 - Frontend PWA / Offline / IoT Demo

Date: 2026-04-24

- PWA (prod): Start `frontend-prod` and confirm `Settings -> Offline & Sync -> PWA Status (proof)` shows SW supported + caches present.
- Offline-first: After visiting Patients/Alerts/Schedule once online, switch the browser offline and confirm those pages still render from cached data (see `docs/ui-snapshots/latest/*offline__patients*.png`, `*offline__alerts*.png`, `*offline__schedule*.png`).
- IoT end-to-end: In `/iot/simulator` connect MQTT and publish a panic alert, then confirm `/alerts` shows the new item (see `docs/ui-snapshots/latest/admin__alerts_after_iot.png` and `docs/ui-snapshots/latest/chw__alerts_after_iot.png`).
