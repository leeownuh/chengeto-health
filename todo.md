# CHENGETO Product Backlog

## Purpose

Turn CHENGETO from a monitoring demo into an elderly-care coordination product that supports day-to-day care delivery.

This backlog is organized by release phase and written to be executable against the current codebase.

## Delivery Rules

- Build new feature logic on canonical models and routes first. Only add compat aliases when an existing screen still depends on them.
- Do not add new demo-data fallbacks.
- Every feature must include:
  - backend model and API work
  - frontend screen and workflow work
  - seeded demo data updates
  - role-based access review
  - audit-log coverage where actions matter clinically
  - API and UI verification

## Shared Foundation

These tasks should happen alongside the feature work below because they affect all phases.

### F0. Stabilize Current Product Surface

Outcome:
- Stop building on fragile demo or compatibility behavior.

Tasks:
- Remove remaining demo fallbacks from:
  - [SchedulePage.jsx](c:/Projects/chengeto/frontend/src/pages/checkin/SchedulePage.jsx)
  - [CheckInHistoryPage.jsx](c:/Projects/chengeto/frontend/src/pages/checkin/CheckInHistoryPage.jsx)
  - [ProfilePage.jsx](c:/Projects/chengeto/frontend/src/pages/settings/ProfilePage.jsx)
- Prefer canonical routes in:
  - [patient.routes.js](c:/Projects/chengeto/backend/routes/patient.routes.js)
  - [checkin.routes.js](c:/Projects/chengeto/backend/routes/checkin.routes.js)
  - [alert.routes.js](c:/Projects/chengeto/backend/routes/alert.routes.js)
  - [schedule.routes.js](c:/Projects/chengeto/backend/routes/schedule.routes.js)
- Keep compat support only where current screens still require:
  - [patient.compat.routes.js](c:/Projects/chengeto/backend/routes/patient.compat.routes.js)
  - [checkin.compat.routes.js](c:/Projects/chengeto/backend/routes/checkin.compat.routes.js)
  - [alert.compat.routes.js](c:/Projects/chengeto/backend/routes/alert.compat.routes.js)
- Add or update test coverage under:
  - [backend/tests](c:/Projects/chengeto/backend/tests)

Definition of done:
- A touched feature no longer depends on demo data to render.
- A touched flow has at least one backend test and one manual verification note.

## Phase 1 - MVP Care Coordination

Goal:
- Make the app useful for daily elderly care management by caregivers, CHWs, and clinicians.

### P1. Personalized Care Plans

Status:
- Implemented and API-verified in the live stack.

Outcome:
- Every patient has a structured care plan with goals, risks, cadence, care team, and escalation preferences.

Backend tasks:
- Extend [Patient.js](c:/Projects/chengeto/backend/models/Patient.js) with:
  - `careGoals`
  - `riskProfile`
  - `visitCadence`
  - `careTeam`
  - `escalationPreferences`
  - `consentSettings`
  - `carePlanReview`
- Add canonical endpoints in [patient.routes.js](c:/Projects/chengeto/backend/routes/patient.routes.js):
  - `GET /api/patients/:id/care-plan`
  - `PUT /api/patients/:id/care-plan`
- Update patient summary serializers in:
  - [patient.compat.routes.js](c:/Projects/chengeto/backend/routes/patient.compat.routes.js)
  - [compat.utils.js](c:/Projects/chengeto/backend/routes/compat.utils.js)
- Write audit events for care-plan changes using:
  - [AuditLog.js](c:/Projects/chengeto/backend/models/AuditLog.js)

Frontend tasks:
- Add a `Care Plan` tab to [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)
- Extend [PatientFormPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientFormPage.jsx) for initial care-plan capture
- Surface care-plan summary cards in:
  - [CaregiverDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CaregiverDashboard.jsx)
  - [ClinicianDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/ClinicianDashboard.jsx)

Seed/data tasks:
- Update [seedDemoData.js](c:/Projects/chengeto/backend/src/scripts/seedDemoData.js) so demo patients include realistic goals, cadence, and escalation settings.

Primary ownership:
- Backend: [Patient.js](c:/Projects/chengeto/backend/models/Patient.js), [patient.routes.js](c:/Projects/chengeto/backend/routes/patient.routes.js)
- Frontend: [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx), [PatientFormPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientFormPage.jsx)

Definition of done:
- Caregiver, clinician, and admin can view care plans.
- Clinician and admin can update care plans.
- Patient detail shows goals, risks, cadence, and escalation rules clearly.

### P2. Medication Adherence

Status:
- Implemented and API-verified in the live stack.
- Remaining polish: schedule-page editing flow and seed-script alignment should still be finished.

Outcome:
- The system tracks scheduled doses, missed doses, side effects, refill needs, and caregiver confirmations.

Backend tasks:
- Extend [CareSchedule.js](c:/Projects/chengeto/backend/models/CareSchedule.js) medication sections to support:
  - dose time
  - refill due date
  - adherence rule
  - side-effect prompts
  - confirmation source
- Extend [CheckIn.js](c:/Projects/chengeto/backend/models/CheckIn.js) medication capture with:
  - scheduled meds due today
  - taken or missed by medication
  - missed-dose reason
  - side effects
  - refill concern
- Add or extend medication APIs in:
  - [patient.routes.js](c:/Projects/chengeto/backend/routes/patient.routes.js)
  - [checkin.routes.js](c:/Projects/chengeto/backend/routes/checkin.routes.js)
  - [schedule.routes.js](c:/Projects/chengeto/backend/routes/schedule.routes.js)
- Add alert creation for repeated misses or refill risk through:
  - [alert.routes.js](c:/Projects/chengeto/backend/routes/alert.routes.js)

Frontend tasks:
- Add medication schedule and confirmation UI in [CheckInPage.jsx](c:/Projects/chengeto/frontend/src/pages/checkin/CheckInPage.jsx)
- Add medication adherence section in [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)
- Add "Today's meds" and "Missed meds" cards in:
  - [CaregiverDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CaregiverDashboard.jsx)
  - [FamilyDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/FamilyDashboard.jsx)
- Add schedule support in [SchedulePage.jsx](c:/Projects/chengeto/frontend/src/pages/checkin/SchedulePage.jsx)

Seed/data tasks:
- Add medications with timing, refill dates, and adherence patterns to [seedDemoData.js](c:/Projects/chengeto/backend/src/scripts/seedDemoData.js)

Primary ownership:
- Backend: [CareSchedule.js](c:/Projects/chengeto/backend/models/CareSchedule.js), [CheckIn.js](c:/Projects/chengeto/backend/models/CheckIn.js), [checkin.routes.js](c:/Projects/chengeto/backend/routes/checkin.routes.js)
- Frontend: [CheckInPage.jsx](c:/Projects/chengeto/frontend/src/pages/checkin/CheckInPage.jsx), [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)

Definition of done:
- A caregiver can confirm or miss a dose during a check-in.
- The patient view shows adherence trends and active refill risks.
- Repeated misses can trigger alerts.

### P3. Fall Risk + Functional Decline

Status:
- Implemented and API-verified in the live stack.
- Remaining polish: baseline editing should eventually be added to the patient form/edit flow instead of relying on API-level updates only.

Outcome:
- The system captures both fall events and gradual decline in function.

Backend tasks:
- Extend [Patient.js](c:/Projects/chengeto/backend/models/Patient.js) with baseline function fields:
  - `mobility`
  - `gait`
  - `balance`
  - `assistiveDevice`
  - `vision`
  - `hearing`
  - `continence`
  - `weightLossRisk`
  - `frailty`
  - `homeSafety`
  - `recentFalls`
- Extend [CheckIn.js](c:/Projects/chengeto/backend/models/CheckIn.js) for structured decline observations:
  - change since last visit
  - fall concerns
  - walking difficulty
  - confusion or cognitive change
  - appetite or weight concern
- Reuse fall alerts in:
  - [iot.routes.js](c:/Projects/chengeto/backend/routes/iot.routes.js)
  - [alert.routes.js](c:/Projects/chengeto/backend/routes/alert.routes.js)
- Add risk-summary helpers in:
  - [compat.utils.js](c:/Projects/chengeto/backend/routes/compat.utils.js)
  - [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js)

Frontend tasks:
- Add functional screening section to [CheckInPage.jsx](c:/Projects/chengeto/frontend/src/pages/checkin/CheckInPage.jsx)
- Add fall and decline summary cards and history to [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)
- Add decline trends to [PatientVitalsPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientVitalsPage.jsx)

Seed/data tasks:
- Add realistic fall-risk and frailty profiles to demo patients in [seedDemoData.js](c:/Projects/chengeto/backend/src/scripts/seedDemoData.js)

Primary ownership:
- Backend: [Patient.js](c:/Projects/chengeto/backend/models/Patient.js), [CheckIn.js](c:/Projects/chengeto/backend/models/CheckIn.js)
- Frontend: [CheckInPage.jsx](c:/Projects/chengeto/frontend/src/pages/checkin/CheckInPage.jsx), [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)

Definition of done:
- A caregiver can record a structured function and fall assessment in under 2 minutes.
- The patient screen makes decline visible over time.

### P4. Caregiver Workflow

Outcome:
- Caregivers and CHWs open the app and immediately know what to do next.
- Status: complete
- Verified live on April 4, 2026:
  - caregiver workflow queue returns due-now, overdue, stale-device, and handoff data
  - CHW workflow queue supports visit completion with optional role handoff
  - a real CHW schedule completion created a caregiver handoff successfully

Backend tasks:
- Add daily task aggregation in [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js):
  - due visits
  - overdue visits
  - unresolved alerts
  - medication tasks
  - transition follow-ups
  - stale devices
- Extend [schedule.routes.js](c:/Projects/chengeto/backend/routes/schedule.routes.js) with task-oriented payloads instead of only schedule rows
- Extend [checkin.routes.js](c:/Projects/chengeto/backend/routes/checkin.routes.js) with quick-complete and note handoff support
- Add handoff note persistence via:
  - [CheckIn.js](c:/Projects/chengeto/backend/models/CheckIn.js)
  - [AuditLog.js](c:/Projects/chengeto/backend/models/AuditLog.js)

Frontend tasks:
- Turn [CaregiverDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CaregiverDashboard.jsx) into a workflow board:
  - due now
  - overdue
  - urgent alerts
  - medication tasks
  - handoff notes
- Upgrade [CHWDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CHWDashboard.jsx) with route-ready visit list and status transitions
- Add quick actions from dashboards into:
  - [CheckInPage.jsx](c:/Projects/chengeto/frontend/src/pages/checkin/CheckInPage.jsx)
  - [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)

Primary ownership:
- Backend: [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js), [schedule.routes.js](c:/Projects/chengeto/backend/routes/schedule.routes.js)
- Frontend: [CaregiverDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CaregiverDashboard.jsx), [CHWDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CHWDashboard.jsx)

Definition of done:
- A caregiver can complete the day's core work from dashboard-driven flows without hunting across screens.

## Phase 2 - Coordination and Clinical Follow-Through

Goal:
- Improve coordination between caregiver, clinician, and family around changes in condition.

### P5. Family Communication

Outcome:
- Family gets consented updates, simple status visibility, and alert acknowledgment without seeing too much.

Backend tasks:
- Extend family access controls in [Patient.js](c:/Projects/chengeto/backend/models/Patient.js) and [patient.routes.js](c:/Projects/chengeto/backend/routes/patient.routes.js)
- Add family timeline endpoints in [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js):
  - daily status
  - updates timeline
  - alert acknowledgment
  - message history
- Record communication events in [AuditLog.js](c:/Projects/chengeto/backend/models/AuditLog.js)

Frontend tasks:
- Expand [FamilyDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/FamilyDashboard.jsx) with:
  - patient okay today check
  - update timeline
  - acknowledge alert
  - message care team
- Add consent visibility to [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)

Primary ownership:
- Backend: [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js), [Patient.js](c:/Projects/chengeto/backend/models/Patient.js)
- Frontend: [FamilyDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/FamilyDashboard.jsx)

Definition of done:
- Family members can see meaningful updates without bypassing care-team boundaries.

### P6. Care Transitions

Outcome:
- Hospital discharge and post-discharge follow-up become a first-class workflow.

Status:
- Shipped on April 4, 2026 across backend routes, dashboards, patient detail, and demo seed data.

Backend tasks:
- Add a new model:
  - [CareTransition.js](c:/Projects/chengeto/backend/models/CareTransition.js)
- Wire into [backend/models/index.js](c:/Projects/chengeto/backend/models/index.js)
- Add endpoints in a new route:
  - [careTransition.routes.js](c:/Projects/chengeto/backend/routes/careTransition.routes.js)
- Track:
  - discharge date
  - discharge reason
  - new meds
  - follow-up tasks
  - red flags
  - 7, 14, and 30 day checkpoints
- Surface transition tasks in [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js)

Frontend tasks:
- Add transition section to [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)
- Add clinician-facing transition management in [ClinicianDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/ClinicianDashboard.jsx)
- Add caregiver follow-up tasks in [CaregiverDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CaregiverDashboard.jsx)

Seed/data tasks:
- Add one active post-discharge patient flow to [seedDemoData.js](c:/Projects/chengeto/backend/src/scripts/seedDemoData.js)

Primary ownership:
- Backend: [CareTransition.js](c:/Projects/chengeto/backend/models/CareTransition.js), [careTransition.routes.js](c:/Projects/chengeto/backend/routes/careTransition.routes.js)
- Frontend: [ClinicianDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/ClinicianDashboard.jsx), [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)

Definition of done:
- Staff can launch and track a discharge follow-up workflow without using notes as a workaround.

### P7. Risk Stratification

Outcome:
- Every patient has a simple priority score with an explanation.

Status:
- Shipped on April 4, 2026 across patient APIs, dashboards, and patient detail explanation views.

Backend tasks:
- Add a new service:
  - [riskScoring.service.js](c:/Projects/chengeto/backend/services/riskScoring.service.js)
- Compute score from:
  - vitals
  - missed meds
  - fall risk
  - decline observations
  - missed visits
  - alert recency
  - caregiver concerns
  - device freshness
- Surface score in:
  - [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js)
  - [patient.routes.js](c:/Projects/chengeto/backend/routes/patient.routes.js)
  - [patient.compat.routes.js](c:/Projects/chengeto/backend/routes/patient.compat.routes.js)

Frontend tasks:
- Show ranked patient lists in:
  - [CaregiverDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CaregiverDashboard.jsx)
  - [CHWDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CHWDashboard.jsx)
  - [ClinicianDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/ClinicianDashboard.jsx)
- Add "why high risk" explanation to [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)

Primary ownership:
- Backend: [riskScoring.service.js](c:/Projects/chengeto/backend/services/riskScoring.service.js), [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js)
- Frontend: [ClinicianDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/ClinicianDashboard.jsx), [CaregiverDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CaregiverDashboard.jsx)

Definition of done:
- The system can explain why Patient A needs attention before Patient B.

## Phase 3 - Operations, Resilience, and Program Management

Goal:
- Make the product operationally useful at program scale in low-resource settings.

### P8. Device Operations

Outcome:
- The system manages device provisioning, trust, calibration, freshness, and data quality.

Backend tasks:
- Extend [IoTDevice.js](c:/Projects/chengeto/backend/models/IoTDevice.js) with:
  - `provisioningStatus`
  - `calibrationStatus`
  - `lastCalibrationAt`
  - `telemetryFreshness`
  - `dataQualityFlags`
  - `firmwareUpdateStatus`
- Extend [iot.routes.js](c:/Projects/chengeto/backend/routes/iot.routes.js) with:
  - provisioning
  - calibration
  - stale-device checks
  - data quality summaries
- Surface stale devices and low-battery risk in:
  - [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js)

Frontend tasks:
- Upgrade admin device registry in [AdminDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/AdminDashboard.jsx)
- Add per-patient device health cards to [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)

Primary ownership:
- Backend: [IoTDevice.js](c:/Projects/chengeto/backend/models/IoTDevice.js), [iot.routes.js](c:/Projects/chengeto/backend/routes/iot.routes.js)
- Frontend: [AdminDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/AdminDashboard.jsx), [PatientDetailPage.jsx](c:/Projects/chengeto/frontend/src/pages/patients/PatientDetailPage.jsx)

Definition of done:
- Staff can tell whether a missing reading is a patient issue or a device issue.

### P9. Community / Offline Mode

Outcome:
- Rural caregivers can keep working through bad connectivity and sync safely later.

Backend tasks:
- Add explicit sync-safe endpoints for:
  - check-ins
  - med confirmations
  - notes
  - family messages
  - care-transition follow-ups
- Add SMS fallback implementation in:
  - [escalation.service.js](c:/Projects/chengeto/backend/services/escalation.service.js)

Frontend tasks:
- Expand [OfflineContext.jsx](c:/Projects/chengeto/frontend/src/contexts/OfflineContext.jsx) to queue:
  - check-ins
  - med events
  - caregiver notes
  - family messages
  - transition follow-ups
- Add sync conflict UI and offline badges in:
  - [MainLayout.jsx](c:/Projects/chengeto/frontend/src/components/layout/MainLayout.jsx)
  - [CheckInPage.jsx](c:/Projects/chengeto/frontend/src/pages/checkin/CheckInPage.jsx)
  - [CaregiverDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/CaregiverDashboard.jsx)

Primary ownership:
- Backend: [escalation.service.js](c:/Projects/chengeto/backend/services/escalation.service.js)
- Frontend: [OfflineContext.jsx](c:/Projects/chengeto/frontend/src/contexts/OfflineContext.jsx), [MainLayout.jsx](c:/Projects/chengeto/frontend/src/components/layout/MainLayout.jsx)

Definition of done:
- A caregiver can complete a visit offline and trust the app to sync it later without silent data loss.

### P10. Program Analytics

Outcome:
- Admins and program leads can measure operational and care outcomes, not just browse raw records.

Backend tasks:
- Extend [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js) analytics to include:
  - missed visits
  - alert response time
  - fall events
  - medication adherence
  - device uptime
  - stale telemetry rate
  - transition completion
  - hospitalization proxy indicators
- Add export-ready analytics summaries.

Frontend tasks:
- Add a dedicated analytics page:
  - [AnalyticsPage.jsx](c:/Projects/chengeto/frontend/src/pages/analytics/AnalyticsPage.jsx)
- Add route in [App.jsx](c:/Projects/chengeto/frontend/src/App.jsx)
- Link from [MainLayout.jsx](c:/Projects/chengeto/frontend/src/components/layout/MainLayout.jsx)
- Keep [AdminDashboard.jsx](c:/Projects/chengeto/frontend/src/pages/dashboard/AdminDashboard.jsx) focused on summary KPIs, not full reporting.

Primary ownership:
- Backend: [dashboard.routes.js](c:/Projects/chengeto/backend/routes/dashboard.routes.js)
- Frontend: [AnalyticsPage.jsx](c:/Projects/chengeto/frontend/src/pages/analytics/AnalyticsPage.jsx), [App.jsx](c:/Projects/chengeto/frontend/src/App.jsx)

Definition of done:
- Admins can answer "how is the program performing?" without leaving the product.

## Recommended Build Order

1. F0. Stabilize current product surface
2. P1. Personalized care plans
3. P2. Medication adherence
4. P3. Fall risk + functional decline
5. P4. Caregiver workflow
6. P5. Family communication
7. P6. Care transitions
8. P7. Risk stratification
9. P8. Device operations
10. P9. Community / offline mode
11. P10. Program analytics

## Suggested Sprint Packaging

### Sprint 1
- F0
- P1

### Sprint 2
- P2
- P3

### Sprint 3
- P4
- P5

### Sprint 4
- P6
- P7

### Sprint 5
- P8
- P9

### Sprint 6
- P10
- UX cleanup
- regression pass

## First Features To Start Coding Immediately

- P1. Personalized care plans
- P2. Medication adherence
- P3. Fall risk + functional decline

These three features unlock the rest of the roadmap because caregiver workflow, risk scoring, family updates, and analytics all depend on them.
