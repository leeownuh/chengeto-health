import express from 'express';
import CareSchedule from '../models/CareSchedule.js';
import CheckIn from '../models/CheckIn.js';
import Patient from '../models/Patient.js';
import AuditLog, { AUDIT_ACTIONS, AUDIT_RESULT } from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { buildPatientAccessMatch, parseLimit } from './compat.utils.js';
import { buildWorkflowSnapshot } from '../utils/workflowTasks.js';

const router = express.Router();

const activityTypeMap = {
  checkin: 'checkup',
  followup: 'checkup',
  medication: 'medication_review',
  vitals: 'vital_check'
};

const activityTypeClientMap = {
  checkup: 'checkin',
  medication_review: 'medication',
  vital_check: 'vitals'
};

function normalizeClientScheduleType(schedule) {
  const raw = schedule?.weeklyActivities?.[0]?.type;
  if (!raw) {
    return 'checkin';
  }

  return activityTypeClientMap[raw] || 'checkin';
}

function addMinutes(timeString, minutes) {
  const [hours, mins] = String(timeString || '09:00').split(':').map(Number);
  const total = hours * 60 + mins + minutes;
  const nextHours = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const nextMinutes = String(total % 60).padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
}

function buildHandoffEntries(input, userId, timestamp = new Date()) {
  if (!input || typeof input !== 'object') {
    return [];
  }

  const note = String(input.note || '').trim();
  if (!note) {
    return [];
  }

  return [
    {
      note,
      targetRole: ['caregiver', 'chw', 'clinician', 'admin', 'family'].includes(input.targetRole)
        ? input.targetRole
        : 'clinician',
      priority: ['low', 'medium', 'high', 'urgent'].includes(input.priority)
        ? input.priority
        : 'medium',
      status: 'pending',
      createdAt: timestamp,
      createdBy: userId
    }
  ];
}

async function logScheduleAudit(req, action, targetId, details = {}, changes = {}) {
  try {
    await AuditLog.log({
      action,
      category: 'checkin',
      result: AUDIT_RESULT.SUCCESS,
      actor: {
        userId: req.user?._id,
        email: req.user?.email,
        role: req.user?.role
      },
      target: {
        type: 'checkin',
        id: targetId,
        model: 'CheckIn'
      },
      request: {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      },
      details,
      changes
    });
  } catch (error) {
    // Audit logging should not break workflow completion.
  }
}

function mapSchedule(schedule, patient, statusOverride = null) {
  const window = schedule.checkinWindows?.[0];
  const titleInstruction = schedule.specialInstructions?.find(
    (instruction) => instruction.type === 'title'
  );
  const notesInstruction = schedule.specialInstructions?.find(
    (instruction) => instruction.type === 'notes'
  );

  const fallbackTitle =
    schedule.title ||
    `${patient?.firstName || 'Patient'} ${patient?.lastName || ''} ${window?.name || 'check-in'}`.trim();

  return {
    _id: schedule._id,
    scheduleId: schedule.scheduleId,
    title:
      titleInstruction?.instruction ?? fallbackTitle,
    patient: patient
      ? {
          _id: patient._id,
          name: `${patient.firstName} ${patient.lastName}`.trim(),
          patientId: patient.patientId
        }
      : null,
    patientId: patient?._id,
    date: schedule.effectiveDate ?? schedule.createdAt,
    time: window?.startTime ?? '09:00',
    duration:
      window?.startTime && window?.endTime
        ? Math.max(
            15,
            (Number(window.endTime.split(':')[0]) * 60 +
              Number(window.endTime.split(':')[1])) -
              (Number(window.startTime.split(':')[0]) * 60 +
                Number(window.startTime.split(':')[1]))
          )
        : 30,
    type: normalizeClientScheduleType(schedule),
    verificationMethods: ['BLE', 'GPS'],
    priority:
      schedule.vitalThresholds?.some((threshold) => threshold.alertLevel === 'critical')
        ? 'high'
        : 'medium',
    status: statusOverride ?? (schedule.status === 'active' ? 'scheduled' : schedule.status),
    notes: notesInstruction?.instruction ?? schedule.description ?? '',
    recurring:
      Array.isArray(window?.days) && window.days.length > 1,
    recurringPattern:
      Array.isArray(window?.days) && window.days.length > 1 ? 'weekly' : 'once'
  };
}

async function getAccessiblePatients(user) {
  return Patient.find(buildPatientAccessMatch(user))
    .select('_id patientId firstName lastName phone address compliance riskLevel')
    .lean({ virtuals: true, getters: true });
}

router.get(
  '/',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => {
    const patients = await getAccessiblePatients(req.user);
    const patientIds = patients.map((patient) => patient._id);
    const schedules = await CareSchedule.find({
      patient: { $in: patientIds }
    })
      .sort({ updatedAt: -1 })
      .limit(parseLimit(req.query.limit, 200, 500))
      .lean();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const completedToday = await CheckIn.find({
      patient: { $in: patientIds },
      status: 'completed',
      actualTime: { $gte: todayStart, $lt: todayEnd }
    })
      .select('patient')
      .lean();
    const completedPatientSet = new Set(completedToday.map((entry) => String(entry.patient)));
    const patientMap = new Map(patients.map((patient) => [String(patient._id), patient]));
    const payload = schedules.map((schedule) =>
      mapSchedule(
        schedule,
        patientMap.get(String(schedule.patient)),
        completedPatientSet.has(String(schedule.patient)) ? 'completed' : null
      )
    );

    res.json({
      success: true,
      data: { schedules: payload },
      schedules: payload
    });
  }
);

router.get(
  '/tasks',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => {
    const patients = await getAccessiblePatients(req.user);
    const workflow = await buildWorkflowSnapshot({
      patients,
      role: req.user.role
    });

    res.json({
      success: true,
      data: workflow
    });
  }
);

router.post(
  '/',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => {
    const patient = await Patient.findById(req.body.patientId).lean();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const schedule = await CareSchedule.create({
      patient: patient._id,
      title: req.body.title || 'Scheduled check-in',
      description: req.body.notes || '',
      scheduledFor: req.body.date ? new Date(`${req.body.date}T${req.body.time || '09:00'}:00`) : new Date(),
      assignedTo: req.user._id,
      recurrence: req.body.recurring
        ? { pattern: req.body.recurringPattern || 'weekly' }
        : { pattern: 'once' },
      effectiveDate: req.body.date ? new Date(req.body.date) : new Date(),
      checkinWindows: [
        {
          name:
            req.body.time && Number(req.body.time.split(':')[0]) >= 15
              ? 'evening'
              : Number(req.body.time?.split(':')[0]) >= 11
                ? 'afternoon'
                : 'morning',
          startTime: req.body.time || '09:00',
          endTime: addMinutes(req.body.time || '09:00', Number(req.body.duration) || 30),
          required: true,
          days:
            req.body.recurring
              ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
              : [],
          assignedCaregiver: req.user.role === 'caregiver' ? req.user._id : undefined
        }
      ],
      weeklyActivities:
        req.body.type && req.body.type !== 'checkin'
          ? [
              {
                type: activityTypeMap[req.body.type] || 'checkup',
                day: 'monday',
                time: req.body.time || '09:00',
                duration: Number(req.body.duration) || 30,
                assignedTo: req.user._id,
                active: true
              }
            ]
          : [],
      specialInstructions: [
        ...(req.body.title ? [{ type: 'title', instruction: req.body.title, active: true }] : []),
        ...(req.body.notes ? [{ type: 'notes', instruction: req.body.notes, active: true }] : [])
      ],
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    });

    res.status(201).json(mapSchedule(schedule.toObject(), patient));
  }
);

router.put(
  '/:id',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => {
    const schedule = await CareSchedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    if (req.body.date) {
      schedule.effectiveDate = new Date(req.body.date);
    }
    schedule.title = req.body.title || schedule.title || 'Scheduled check-in';
    schedule.description = req.body.notes || schedule.description || '';
    schedule.scheduledFor = req.body.date
      ? new Date(`${req.body.date}T${req.body.time || schedule.checkinWindows?.[0]?.startTime || '09:00'}:00`)
      : schedule.scheduledFor;
    schedule.assignedTo = req.user._id;
    schedule.recurrence = req.body.recurring
      ? { pattern: req.body.recurringPattern || 'weekly' }
      : { pattern: 'once' };

    schedule.checkinWindows = [
      {
        name:
          req.body.time && Number(req.body.time.split(':')[0]) >= 15
            ? 'evening'
            : Number(req.body.time?.split(':')[0]) >= 11
              ? 'afternoon'
              : 'morning',
        startTime: req.body.time || schedule.checkinWindows?.[0]?.startTime || '09:00',
        endTime: addMinutes(
          req.body.time || schedule.checkinWindows?.[0]?.startTime || '09:00',
          Number(req.body.duration) || 30
        ),
        required: true,
        days:
          req.body.recurring
            ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            : [],
        assignedCaregiver:
          schedule.checkinWindows?.[0]?.assignedCaregiver ??
          (req.user.role === 'caregiver' ? req.user._id : undefined)
      }
    ];
    schedule.specialInstructions = [
      ...(req.body.title ? [{ type: 'title', instruction: req.body.title, active: true }] : []),
      ...(req.body.notes ? [{ type: 'notes', instruction: req.body.notes, active: true }] : [])
    ];
    schedule.weeklyActivities =
      req.body.type && req.body.type !== 'checkin'
        ? [
            {
              type: activityTypeMap[req.body.type] || 'checkup',
              day: 'monday',
              time: req.body.time || '09:00',
              duration: Number(req.body.duration) || 30,
              assignedTo: req.user._id,
              active: true
            }
          ]
        : [];
    schedule.lastModifiedBy = req.user._id;
    await schedule.save();

    const patient = await Patient.findById(schedule.patient).lean();
    res.json(mapSchedule(schedule.toObject(), patient));
  }
);

router.delete(
  '/:id',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => {
    await CareSchedule.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  }
);

router.post(
  '/:id/complete',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => {
    const schedule = await CareSchedule.findById(req.params.id).lean();

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    const completedAt = new Date();
    const handoffEntries = buildHandoffEntries(req.body.handoff, req.user._id, completedAt);
    const score = Number.parseFloat(req.body.wellnessScore) || 7;
    const checkIn = await CheckIn.create({
      patient: schedule.patient,
      caregiver: req.user._id,
      type: 'scheduled',
      verificationMethod: 'manual_override',
      scheduledTime: completedAt,
      actualTime: completedAt,
      status: 'completed',
      scheduledWindow: schedule.checkinWindows?.[0]
        ? {
            name: schedule.checkinWindows[0].name,
            startTime: schedule.checkinWindows[0].startTime,
            endTime: schedule.checkinWindows[0].endTime
          }
        : undefined,
      proximityVerification: {
        method: 'manual_override',
        verified: true,
        verifiedAt: completedAt
      },
      wellness: {
        overallStatus: score >= 8 ? 'good' : score >= 5 ? 'fair' : 'poor',
        mobility: 'normal',
        mood: 'neutral',
        appearance: 'normal',
        consciousness: 'alert',
        pain: { present: false, level: 0 }
      },
      wellnessAssessment: {
        overallScore: Math.round(score * 10),
        notes: req.body.notes || 'Completed from schedule management'
      },
      medication: {
        adherence: 'taken'
      },
      notes: {
        caregiver: req.body.notes || 'Completed from schedule management',
        concerns: Array.isArray(req.body.concerns) ? req.body.concerns : [],
        highlights: [],
        handoffs: handoffEntries
      },
      followUp: handoffEntries.length > 0
        ? {
            required: true,
            reason: handoffEntries[0].note,
            priority: handoffEntries[0].priority
          }
        : undefined
    });

    await Patient.updateOne(
      { _id: schedule.patient },
      {
        $set: {
          'compliance.lastCheckin': completedAt,
          'compliance.consecutiveMissedCheckins': 0
        }
      }
    );

    await logScheduleAudit(req, AUDIT_ACTIONS.CHECKIN_UPDATE, checkIn._id, {
      message: 'Check-in completed from schedule workflow',
      scheduleId: schedule._id,
      handoffCreated: handoffEntries.length > 0
    });

    const patient = await Patient.findById(schedule.patient).lean();
    res.json(mapSchedule(schedule, patient, 'completed'));
  }
);

export default router;
