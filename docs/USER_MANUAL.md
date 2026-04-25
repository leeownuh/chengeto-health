# CHENGETO Health System - User Manual

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Roles and Permissions](#user-roles-and-permissions)
4. [Navigation and Interface](#navigation-and-interface)
5. [Patient Management](#patient-management)
6. [Check-In System](#check-in-system)
7. [Alert Management](#alert-management)
8. [Schedule Management](#schedule-management)
9. [IoT Device Monitoring](#iot-device-monitoring)
10. [Reports and Analytics](#reports-and-analytics)
11. [Settings and Profile](#settings-and-profile)
12. [Mobile App Usage](#mobile-app-usage)
13. [Offline Functionality](#offline-functionality)
14. [Troubleshooting](#troubleshooting)
15. [Glossary](#glossary)
16. [Support and Contact](#support-and-contact)

---

## Introduction

### Welcome to CHENGETO Health

CHENGETO Health is a comprehensive community health worker (CHW) accountability and patient monitoring system designed to improve healthcare delivery in Zimbabwe. The system leverages IoT technology, mobile applications, and blockchain to ensure transparent, accountable, and efficient patient care.

### Purpose of This Manual

This user manual provides step-by-step guidance for all users of the CHENGETO Health system. Whether you are a Community Health Worker, Caregiver, Patient, Administrator, or Clinician, this manual will help you navigate and utilize the system effectively.

### Key Features

- **Real-time Patient Monitoring**: Track patient vital signs and health status through IoT devices
- **Accountability System**: Verify CHW visits through BLE, NFC, and GPS verification
- **Alert Management**: Automated escalation of health alerts with configurable thresholds
- **Schedule Management**: Comprehensive scheduling for patient visits and care activities
- **Offline Capability**: Full functionality in areas with limited connectivity
- **Blockchain Verification**: Immutable audit trail for all critical actions
- **Multi-role Access**: Customized interfaces for different user types

---

## Getting Started

### System Requirements

#### For Web Application
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Stable internet connection (minimum 1 Mbps)
- JavaScript enabled
- Cookies enabled

#### For Mobile Application
- Android 8.0+ or iOS 14.0+
- 100 MB free storage
- Bluetooth 4.0+ (for BLE verification)
- NFC capability (for NFC verification)
- GPS enabled

### Account Registration

#### Step 1: Receive Invitation
New users receive an email or SMS invitation with a registration link.

#### Step 2: Complete Registration
1. Click the registration link in your invitation
2. Enter your personal information:
   - Full name
   - Email address
   - Phone number (with country code)
   - National ID number (optional)
3. Create a strong password:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character
4. Review and accept the Terms of Service
5. Click "Create Account"

#### Step 3: Verify Your Account
1. Check your email for a verification code
2. Enter the 6-digit code on the verification screen
3. If you don't receive the email, click "Resend Code"

#### Step 4: Set Up Two-Factor Authentication (Recommended)
1. Download an authenticator app (Google Authenticator, Authy, or Microsoft Authenticator)
2. Scan the QR code displayed on the screen
3. Enter the 6-digit code from your authenticator app
4. Save your backup codes in a secure location

### First-Time Login

1. Navigate to the CHENGETO Health login page
2. Enter your email address
3. Enter your password
4. If prompted, enter your 2FA code
5. Click "Sign In"
6. On first login, you will be prompted to:
   - Complete your profile
   - Review notification preferences
   - Set your timezone and language

---

## User Roles and Permissions

### Administrator

**Description**: System administrators have full access to all features and settings.

**Permissions**:
- Manage all users and their roles
- Configure system settings
- Access all patient records
- Generate comprehensive reports
- Manage IoT devices
- Configure alert thresholds
- Access audit logs
- Manage blockchain settings

**Dashboard Features**:
- System overview with key metrics
- User management panel
- System health monitoring
- Configuration settings
- Audit log viewer

### Community Health Worker (CHW)

**Description**: CHWs are frontline health workers responsible for patient visits and care delivery.

**Permissions**:
- View assigned patients
- Create and complete check-ins
- View and acknowledge alerts
- Manage own schedule
- Update patient vital signs
- Request escalations

**Dashboard Features**:
- Today's visit schedule
- Pending check-ins
- Active alerts for assigned patients
- Quick check-in button
- Offline sync status

### Caregiver

**Description**: Caregivers are family members or designated individuals who provide day-to-day care for patients.

**Permissions**:
- View assigned patients
- Create check-ins
- View patient health status
- Receive alerts and notifications
- View care schedule

**Dashboard Features**:
- Patient health overview
- Medication reminders
- Upcoming appointments
- Quick check-in option
- Communication with CHW

### Patient

**Description**: Patients are individuals receiving care through the CHENGETO system.

**Permissions**:
- View own health records
- Update personal information
- View care schedule
- Receive health reminders
- Connect IoT devices
- View assigned caregivers and CHWs

**Dashboard Features**:
- Personal health status
- Upcoming visits
- Connected devices
- Health trends
- Medication schedule

### Clinician

**Description**: Clinicians are healthcare professionals who oversee patient care and make medical decisions.

**Permissions**:
- View all patient records
- Access detailed health reports
- Manage patient care plans
- Escalate critical cases
- Communicate with CHWs
- Access audit trails

**Dashboard Features**:
- Patient caseload overview
- Critical alerts requiring attention
- Care plan management
- CHW performance metrics
- Clinical reports

### Family Member

**Description**: Family members can monitor their loved ones' health status.

**Permissions**:
- View assigned patient's health summary
- Receive critical alerts
- View visit history
- Communicate with caregivers

**Dashboard Features**:
- Patient health summary
- Recent check-ins
- Upcoming visits
- Contact information for care team

### Auditor

**Description**: Auditors verify system integrity and compliance.

**Permissions**:
- Access blockchain audit trail
- View all system logs
- Generate compliance reports
- Verify visit authenticity
- Access aggregated statistics

**Dashboard Features**:
- Blockchain verification panel
- Audit log viewer
- Compliance metrics
- Verification tools
- Report generator

---

## Navigation and Interface

### Main Navigation Menu

The navigation menu is located on the left side of the screen (desktop) or accessible via the hamburger menu (mobile).

#### Dashboard
Access your personalized dashboard with role-specific widgets and quick actions.

#### Patients
View and manage patient records. Available options vary by role.

#### Check-ins
Access the check-in system for recording patient visits.

#### Alerts
View and manage health alerts and notifications.

#### Schedule
Manage visit schedules and appointments.

#### IoT Devices
View and manage connected IoT devices (Admin and CHW only).

#### Reports
Generate and view reports and analytics.

#### Settings
Configure your account and application preferences.

### Dashboard Overview

Your dashboard provides a quick overview of important information:

1. **Header Bar**: Displays your name, role, and notification bell
2. **Quick Stats**: Key metrics relevant to your role
3. **Action Cards**: Quick access to common tasks
4. **Recent Activity**: Latest system activities
5. **Alerts Summary**: Current alerts requiring attention

### Common UI Elements

#### Status Chips
- **Green**: Normal/Success
- **Yellow**: Warning/Attention needed
- **Red**: Critical/Error
- **Blue**: Information
- **Gray**: Inactive/Pending

#### Action Buttons
- **Primary (Blue)**: Main action
- **Secondary (Gray)**: Alternative action
- **Danger (Red)**: Destructive action
- **Success (Green)**: Positive action

#### Data Tables
- Click column headers to sort
- Use the search box to filter
- Use pagination at the bottom to navigate
- Click on rows for detailed view

---

## Patient Management

### Viewing Patients

#### Access Patient List
1. Click "Patients" in the navigation menu
2. View the list of patients you have access to
3. Use filters to narrow down the list:
   - Status (Active, Inactive)
   - Location
   - Assigned CHW
   - Health condition

#### Search for a Patient
1. Click the search box at the top of the patient list
2. Enter the patient's name, ID, or phone number
3. Results will update as you type
4. Press Enter to search all fields

#### View Patient Details
1. Click on a patient row in the list
2. The patient profile will open, showing:
   - Personal information
   - Health conditions
   - Medications
   - Assigned caregivers
   - Visit history
   - Connected devices
   - Vital signs trends

### Adding a New Patient (Admin/CHW)

#### Step 1: Start Registration
1. Navigate to Patients > Add New Patient
2. Or click the "+" button on the patient list

#### Step 2: Personal Information
1. Enter required fields:
   - First name
   - Last name
   - Date of birth
   - Gender
   - Phone number
   - Address
   - District/Province
2. Enter optional fields:
   - National ID
   - Emergency contact
   - Preferred language

#### Step 3: Medical Information
1. Select primary health condition
2. Add secondary conditions if applicable
3. List current medications
4. Note any allergies
5. Enter blood type if known

#### Step 4: Assign Care Team
1. Select primary CHW
2. Add caregivers:
   - Enter caregiver name
   - Enter relationship to patient
   - Enter contact information
3. Assign clinician (optional)

#### Step 5: Configure Monitoring
1. Set check-in frequency
2. Configure alert thresholds:
   - Heart rate limits
   - Blood pressure limits
   - Temperature limits
   - SpO2 limits
3. Add special instructions

#### Step 6: Review and Submit
1. Review all entered information
2. Make any necessary corrections
3. Click "Register Patient"
4. The patient ID will be generated automatically

### Editing Patient Information

#### Update Personal Details
1. Open the patient profile
2. Click "Edit" in the appropriate section
3. Make your changes
4. Click "Save Changes"

#### Update Medical Information
1. Open the patient profile
2. Navigate to the "Medical" tab
3. Click "Edit Medical Info"
4. Update conditions, medications, or allergies
5. Click "Save Changes"

**Note**: Changes to medical information are recorded in the audit trail.

### Transferring a Patient (Admin)

1. Open the patient profile
2. Click "Transfer Patient" in the actions menu
3. Select the new primary CHW
4. Add a transfer reason
5. Set the transfer effective date
6. Click "Confirm Transfer"

---

## Check-In System

### Types of Check-Ins

#### Routine Check-In
Regular scheduled visit to assess patient health and record vitals.

#### Unscheduled Check-In
Emergency or follow-up visit outside the regular schedule.

#### Remote Check-In
Virtual check-in conducted via phone or video call (limited verification).

### Conducting a Check-In

#### Step 1: Initiate Check-In
1. Navigate to Check-ins > New Check-in
2. Or click the patient's "Quick Check-In" button
3. Select the patient from your assigned list

#### Step 2: Verification
Verification ensures accountability and confirms your presence:

##### BLE Verification (Bluetooth)
1. Ensure Bluetooth is enabled on your device
2. Click "Verify via BLE"
3. Hold your device near the patient's BLE beacon
4. Wait for the connection confirmation
5. Verification status will update

##### NFC Verification
1. Ensure NFC is enabled on your device
2. Click "Verify via NFC"
3. Tap your device on the patient's NFC tag
4. Verification will be automatic

##### GPS Verification
1. Click "Verify via GPS"
2. Allow location access if prompted
3. Your current location will be captured
4. The system verifies you are at the patient's location

#### Step 3: Record Vitals
1. Enter vital signs manually or receive from IoT devices:
   - **Heart Rate**: Beats per minute (bpm)
   - **Blood Pressure**: Systolic/Diastolic (mmHg)
   - **Temperature**: Celsius or Fahrenheit
   - **SpO2**: Oxygen saturation percentage
   - **Blood Glucose**: mg/dL or mmol/L
   - **Weight**: kg or lbs
2. Values outside normal ranges will trigger alerts

#### Step 4: Wellness Assessment
1. Complete the wellness questionnaire:
   - Overall feeling (1-10 scale)
   - Pain level (0-10 scale)
   - Symptoms checklist
   - Medication adherence
   - Dietary status
   - Activity level
2. Add notes about the patient's condition

#### Step 5: Complete Check-In
1. Review all entered information
2. Add any additional notes
3. Select follow-up actions if needed:
   - Schedule next visit
   - Create alert
   - Request escalation
4. Click "Submit Check-In"
5. The check-in will be recorded on the blockchain

### Viewing Check-In History

#### Access History
1. Navigate to Check-ins > History
2. View all check-ins for your assigned patients

#### Filter History
1. Use filters to narrow results:
   - Date range
   - Patient
   - CHW
   - Verification status
   - Health status

#### View Details
1. Click on a check-in row to view details
2. See full vital signs, notes, and verification data
3. View blockchain transaction ID for verification

### Check-In Best Practices

1. **Always verify your presence**: Use BLE, NFC, or GPS verification
2. **Record accurate vitals**: Double-check measurements before submitting
3. **Add detailed notes**: Document observations for continuity of care
4. **Complete all required fields**: Missing data affects care quality
5. **Submit promptly**: Don't delay check-in submission

---

## Alert Management

### Understanding Alerts

Alerts are automatic or manual notifications that require attention. They are triggered by:

- Vital signs outside normal ranges
- Missed check-ins
- Medication non-adherence
- Patient-reported symptoms
- IoT device malfunctions

### Alert Severity Levels

#### Critical (Red)
Immediate attention required. Life-threatening condition.

**Response Time**: Within 15 minutes

**Examples**:
- Heart rate above 140 or below 40 bpm
- SpO2 below 90%
- Temperature above 40°C
- Blood pressure above 180/120 mmHg

#### High (Orange)
Urgent attention required. Serious but not immediately life-threatening.

**Response Time**: Within 1 hour

**Examples**:
- Heart rate 120-140 or 40-50 bpm
- SpO2 90-92%
- Temperature 39-40°C
- Missed critical medication dose

#### Medium (Yellow)
Attention needed. Requires follow-up within the day.

**Response Time**: Within 4 hours

**Examples**:
- Heart rate 100-120 bpm
- SpO2 92-94%
- Temperature 38-39°C
- Missed routine check-in

#### Low (Blue)
Informational. No immediate action required.

**Response Time**: Within 24 hours

**Examples**:
- Device battery low
- Scheduled maintenance
- Minor vital deviation
- General reminders

### Managing Alerts

#### Viewing Alerts
1. Navigate to Alerts in the main menu
2. View all active alerts
3. Filter by severity, status, or patient

#### Acknowledging an Alert
1. Click on the alert to view details
2. Review the patient information and vital signs
3. Click "Acknowledge"
4. This indicates you have seen the alert

#### Resolving an Alert
1. Open the alert details
2. Take necessary action (visit patient, contact caregiver, etc.)
3. Click "Resolve Alert"
4. Enter resolution notes
5. Select resolution type:
   - False Alarm
   - Resolved - Treatment Given
   - Resolved - No Action Needed
   - Escalated
   - Patient Unreachable

#### Escalating an Alert
If you cannot resolve an alert:
1. Open the alert details
2. Click "Escalate"
3. Select escalation reason
4. Add notes
5. Click "Confirm Escalation"
6. The alert will be forwarded to the next level

### Alert Escalation Flow

1. **Initial Alert**: Generated and sent to assigned CHW
2. **15 minutes**: If not acknowledged, escalated to supervisor
3. **1 hour**: If not resolved, escalated to clinician
4. **4 hours**: If not resolved, escalated to administrator
5. **24 hours**: If not resolved, escalated to district health office

### Alert Notifications

#### In-App Notifications
- Bell icon in header shows unread count
- Click to view all notifications
- Real-time updates via WebSocket

#### SMS Notifications
- Critical and High alerts sent via SMS
- Configured in notification settings
- Includes patient ID and alert summary

#### Email Notifications
- Daily digest of all alerts
- Immediate emails for Critical alerts
- Configured in notification settings

---

## Schedule Management

### Calendar Views

#### Day View
Shows all scheduled visits for the current day.
- Hourly timeline
- Visit duration
- Patient location
- Check-in status

#### Week View
Shows the current week's schedule.
- Overview of all days
- Visit counts per day
- Easy navigation between days

#### Month View
Shows the entire month at a glance.
- Visit density visualization
- Quick date selection
- Summary statistics

### Managing Visits

#### Creating a Schedule
1. Navigate to Schedule > New Schedule
2. Select patient(s)
3. Set visit frequency:
   - Daily
   - Weekly
   - Bi-weekly
   - Monthly
   - Custom
4. Select preferred days
5. Set time window
6. Add notes or special instructions
7. Click "Create Schedule"

#### Editing a Schedule
1. Open the schedule from the calendar
2. Click "Edit"
3. Make your changes
4. Click "Save Changes"

#### Canceling a Visit
1. Find the visit on the calendar
2. Click on the visit
3. Select "Cancel"
4. Enter cancellation reason
5. Choose to notify the patient/caregiver
6. Click "Confirm Cancellation"

#### Rescheduling a Visit
1. Find the visit on the calendar
2. Click on the visit
3. Select "Reschedule"
4. Choose new date and time
5. Add a reason
6. Click "Confirm Reschedule"

### Schedule Notifications

- **Reminder**: Sent 1 hour before scheduled visit
- **Due Now**: Sent at the scheduled time
- **Overdue**: Sent 30 minutes after scheduled time if not completed

---

## IoT Device Monitoring

### Supported Devices

- **Pulse Oximeters**: Heart rate and SpO2 measurement
- **Blood Pressure Monitors**: Systolic and diastolic pressure
- **Thermometers**: Body temperature
- **Glucometers**: Blood glucose levels
- **Weight Scales**: Body weight
- **BLE Beacons**: Presence verification
- **NFC Tags**: Tap-to-verify functionality

### Device Simulator (No Hardware Demo)

For demos (e.g., professor review) you can simulate real sensor devices directly in the web app:

1. Log in as **Admin** or **CHW**
2. Open **IoT Simulator** (route: `/iot/simulator`)
3. Select a patient/device and publish **once** or start **streaming**

Under the hood the simulator acts like a real device:

- Protocol: MQTT over WebSockets (broker WS port `8083`)
- Topics:
  - `chengeto/<patientId>/telemetry` (vitals + device status)
  - `chengeto/<patientId>/alert` (panic/fall/etc events)
- The backend ingests MQTT messages into MongoDB and broadcasts realtime UI updates.

### Device Management (Admin)

#### Registering a New Device
1. Navigate to IoT > Devices
2. Click "Add Device"
3. Select device type
4. Enter device details:
   - Device ID
   - Serial number
   - Manufacturer
   - Firmware version
5. Assign to patient
6. Configure settings:
   - Data transmission frequency
   - Alert thresholds
   - Battery monitoring
7. Click "Register Device"

#### Updating Device Firmware
1. Navigate to IoT > Devices
2. Select the device
3. Click "Update Firmware"
4. Upload the firmware file or select from repository
5. Click "Start Update"
6. Monitor progress

#### Viewing Device Data
1. Navigate to IoT > Device Data
2. Select device type and date range
3. View real-time data stream
4. Export data if needed

### Device Status Indicators

- **Online (Green)**: Device connected and transmitting
- **Offline (Gray)**: Device not connected
- **Low Battery (Yellow)**: Battery below 20%
- **Error (Red)**: Device malfunction detected
- **Maintenance (Blue)**: Device in maintenance mode

---

## Reports and Analytics

### Available Reports

#### Patient Health Report
- Individual patient health trends
- Vital signs over time
- Check-in history
- Alert history
- Medication adherence

#### CHW Performance Report
- Visits completed vs scheduled
- Check-in verification rate
- Average response time
- Patient outcomes

#### Alert Summary Report
- Alerts by type and severity
- Resolution times
- Escalation patterns
- Outcome analysis

#### System Usage Report
- User activity
- Feature usage statistics
- Peak usage times
- Error rates

### Generating Reports

1. Navigate to Reports
2. Select report type
3. Set parameters:
   - Date range
   - Patient(s) or CHW(s)
   - Specific metrics
4. Choose output format:
   - View online
   - PDF export
   - CSV export
5. Click "Generate Report"

### Dashboard Analytics

#### Key Metrics
- Total patients under care
- Active alerts count
- Check-ins today
- Average response time
- Device connectivity rate

#### Trend Charts
- Patient health trends
- Visit completion rates
- Alert patterns over time
- CHW activity patterns

---

## Settings and Profile

### Profile Settings

#### Updating Personal Information
1. Navigate to Settings > Profile
2. Edit your information:
   - Name
   - Phone number
   - Email address
   - Profile picture
3. Click "Save Changes"

#### Changing Password
1. Navigate to Settings > Security
2. Click "Change Password"
3. Enter current password
4. Enter new password
5. Confirm new password
6. Click "Update Password"

#### Setting Up Two-Factor Authentication
1. Navigate to Settings > Security
2. Click "Enable 2FA"
3. Scan QR code with authenticator app
4. Enter verification code
5. Save backup codes

### Notification Settings

#### In-App Notifications
1. Navigate to Settings > Notifications
2. Toggle notification types on/off:
   - Alert notifications
   - Schedule reminders
   - System updates
   - Patient updates

#### SMS Notifications
1. Navigate to Settings > Notifications
2. Configure SMS preferences:
   - Critical alerts only
   - All alerts
   - Schedule reminders
   - Off

#### Email Notifications
1. Navigate to Settings > Notifications
2. Configure email preferences:
   - Daily digest
   - Immediate for critical
   - Weekly summary
   - Off

### Appearance Settings

#### Theme Selection
1. Navigate to Settings > Appearance
2. Select theme:
   - Light
   - Dark
   - System default

#### Language Selection
1. Navigate to Settings > Appearance
2. Select preferred language:
   - English
   - Shona
   - Ndebele

### Data Settings

#### Export Your Data
1. Navigate to Settings > Data
2. Click "Export My Data"
3. Select data types to include
4. Choose format (JSON or CSV)
5. Click "Export"

#### Clear Local Data
1. Navigate to Settings > Data
2. Click "Clear Local Data"
3. Confirm the action
4. This removes cached data from your device

---

## Mobile App Usage

### Installing the App

#### Android
1. Open Google Play Store
2. Search for "CHENGETO Health"
3. Tap "Install"
4. Open the app after installation

#### iOS
1. Open App Store
2. Search for "CHENGETO Health"
3. Tap "Get"
4. Open the app after installation

### App Permissions

The app requests the following permissions:

- **Location**: Required for GPS verification
- **Bluetooth**: Required for BLE verification
- **NFC**: Required for NFC verification
- **Camera**: Optional, for profile pictures and document scanning
- **Storage**: For offline data storage
- **Phone**: For making calls to patients/caregivers

### Mobile-Specific Features

#### Quick Check-In
- One-tap check-in from home screen widget
- Voice-to-text for notes
- Camera integration for wound photos

#### Push Notifications
- Real-time alert notifications
- Schedule reminders
- System updates

#### Offline Mode
- Full functionality without internet
- Automatic sync when connected
- Conflict resolution

---

## Offline Functionality

### How Offline Mode Works

CHENGETO Health is designed to work in areas with limited connectivity:

1. **Data Caching**: All patient data is cached locally
2. **IndexedDB Storage**: Secure local database
3. **Service Worker**: Handles network requests
4. **Sync Queue**: Queues actions for later sync

### Working Offline

#### Offline Access (Login)
- If you have signed in before, the app can open while offline using your last saved session.
- If you have never signed in on that device/browser, you must connect once to complete the first login.

#### Check-Ins
- Complete check-ins offline
- Data stored locally
- Synced automatically when connected

#### Patient Records
- View cached patient information
- Limited to assigned patients
- Updates sync when online

#### Alerts
- Receive alerts via SMS when offline
- View cached alert history
- Create local notes

### PWA Status (Install / Service Worker)

To verify the PWA is active on a device/browser:

1. Go to **Settings**
2. Open **Offline & Sync**
3. Check **PWA Status (proof)** for service worker, manifest, and cache status

### Syncing Data

#### Automatic Sync
- When connection is restored
- Every 5 minutes when online
- After completing an action

#### Manual Sync
1. Click the sync icon in the header
2. View sync status
3. Force sync if needed

#### Conflict Resolution
If the same data is modified in two places:
1. Server version takes precedence
2. User is notified of conflict
3. Option to keep local or server version

### Offline Indicators

- **Green indicator**: Online, synced
- **Yellow indicator**: Online, syncing
- **Red indicator**: Offline
- **Gray indicator**: Offline with pending actions

---

## Troubleshooting

### Common Issues

#### Cannot Log In

**Symptoms**: "Invalid credentials" error

**Solutions**:
1. Check your email and password
2. Ensure caps lock is off
3. Try "Forgot Password" to reset
4. Clear browser cache
5. Try a different browser

#### Two-Factor Authentication Issues

**Symptoms**: Cannot generate 2FA code

**Solutions**:
1. Check your device's time settings
2. Re-scan the QR code
3. Use backup codes
4. Contact administrator for reset

#### Bluetooth Not Connecting

**Symptoms**: BLE verification fails

**Solutions**:
1. Ensure Bluetooth is enabled
2. Check device permissions
3. Move closer to the BLE beacon
4. Restart the app
5. Restart your device

#### GPS Verification Fails

**Symptoms**: "Location verification failed"

**Solutions**:
1. Enable location services
2. Grant location permission to the app
3. Wait for GPS lock (may take 1-2 minutes)
4. Move to an area with clear sky view
5. Check that patient's registered location is correct

#### Data Not Syncing

**Symptoms**: Offline indicator remains, data not updating

**Solutions**:
1. Check your internet connection
2. Click the sync button
3. Log out and log back in
4. Clear local data and re-sync
5. Contact support if persistent

#### Alerts Not Received

**Symptoms**: Missing alert notifications

**Solutions**:
1. Check notification settings
2. Ensure app notifications are enabled in device settings
3. Check SMS/email notification settings
4. Verify your contact information is correct
5. Test with a manual alert

### Error Messages

#### "Session Expired"
Your session has timed out for security. Please log in again.

#### "Permission Denied"
You do not have permission to perform this action. Contact your administrator.

#### "Device Not Found"
The IoT device could not be located. Check the device is powered on and in range.

#### "Sync Failed"
Data synchronization failed. Check your connection and try again.

#### "Validation Error"
The data entered is invalid. Please check all fields and correct any errors.

### Getting Help

#### In-App Help
- Click the "?" icon in any section
- Access context-sensitive help
- View tutorials and guides

#### Support Contact
- Email: support@chengeto.health
- Phone: +263 XXX XXX XXX
- WhatsApp: +263 XXX XXX XXX
- Hours: Monday-Friday, 8am-5pm

---

## Glossary

| Term | Definition |
|------|------------|
| **BLE** | Bluetooth Low Energy - wireless technology for short-range communication |
| **Check-In** | A recorded visit with a patient including vitals and assessment |
| **CHW** | Community Health Worker - frontline healthcare provider |
| **Escalation** | The process of forwarding an alert to a higher authority |
| **IoT** | Internet of Things - connected devices that transmit data |
| **NFC** | Near Field Communication - technology for tap-to-verify functionality |
| **PWA** | Progressive Web App - web application that works offline |
| **SpO2** | Blood oxygen saturation percentage |
| **Vitals** | Essential physiological measurements (heart rate, blood pressure, etc.) |
| **Blockchain** | Distributed ledger technology for immutable record keeping |

---

## Support and Contact

### Technical Support

**Email**: support@chengeto.health

**Phone**: +263 XXX XXX XXX

**WhatsApp**: +263 XXX XXX XXX

**Hours**: Monday-Friday, 8:00 AM - 5:00 PM (CAT)

### Training Resources

- **Video Tutorials**: Available on the CHENGETO YouTube channel
- **Knowledge Base**: help.chengeto.health
- **User Community**: community.chengeto.health

### Report an Issue

To report a bug or technical issue:

1. Navigate to Settings > Help
2. Click "Report an Issue"
3. Describe the problem
4. Attach screenshots if possible
5. Submit the report

### Feedback

We value your feedback! Share your suggestions:

1. Navigate to Settings > Help
2. Click "Send Feedback"
3. Rate your experience
4. Provide comments
5. Submit

---

## Document Information

**Version**: 1.0.0

**Last Updated**: January 2025

**Author**: CHENGETO Health Development Team

**Review Date**: July 2025

---

© 2025 CHENGETO Health System. All rights reserved.
