/**
 * Seed "today" appointment-style schedules for the Schedule Management UI.
 *
 * Why: the Schedule page groups items by `effectiveDate` and will look empty if
 * no schedules fall on the current date. This script creates (or refreshes)
 * a small set of schedules for the current day so screenshots show populated
 * appointments.
 *
 * Safe to re-run: it upserts per patient+time for today's date window.
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import CareSchedule from '../models/CareSchedule.js';
import User from '../models/User.js';

const parseTimeToDate = (baseDate, timeHHmm) => {
  const [hh, mm] = String(timeHHmm || '09:00').split(':').map((v) => Number(v));
  const date = new Date(baseDate);
  date.setHours(hh || 0, mm || 0, 0, 0);
  return date;
};

const addMinutes = (timeHHmm, minutes) => {
  const [hours, mins] = String(timeHHmm || '09:00').split(':').map(Number);
  const total = hours * 60 + mins + Number(minutes || 0);
  const nextHours = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const nextMinutes = String(total % 60).padStart(2, '0');
  return `${nextHours}:${nextMinutes}`;
};

const weekdayName = (date) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()] || 'monday';
};

const windowName = (timeHHmm) => {
  const [h] = String(timeHHmm || '09:00').split(':').map(Number);
  if (h >= 18) return 'evening';
  if (h >= 12) return 'afternoon';
  return 'morning';
};

const main = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!uri) {
    throw new Error('Missing MONGODB_URI (or MONGO_URI).');
  }

  console.log('[seedTodayAppointments] connecting...');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000
  });
  console.log('[seedTodayAppointments] connected');

  const now = new Date();

  // Use "noon local time" to avoid timezone edge cases when displayed in different locales.
  const todayNoon = new Date(now);
  todayNoon.setHours(12, 0, 0, 0);

  const todayStart = new Date(todayNoon);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const patients = await Patient.find({})
    .sort({ createdAt: 1 })
    .limit(5)
    .select('_id firstName lastName patientId assignedCaregiver')
    .lean();
  console.log('[seedTodayAppointments] patients', patients.length);

  if (patients.length === 0) {
    console.log('No patients found; nothing to seed.');
    await mongoose.disconnect();
    return;
  }

  // Try to attach appointments to a caregiver where possible.
  const caregivers = await User.find({ role: 'caregiver' }).select('_id email').lean();
  console.log('[seedTodayAppointments] caregivers', caregivers.length);
  const fallbackAssignee = caregivers[0]?._id || null;

  const times = ['08:30', '13:00', '17:30'];
  const durationMinutes = 30;
  const day = weekdayName(todayNoon);

  let upserted = 0;
  for (let index = 0; index < Math.min(patients.length, times.length); index += 1) {
    const patient = patients[index];
    const time = times[index];
    console.log('[seedTodayAppointments] upsert', patient.patientId || String(patient._id), time);
    const scheduledFor = parseTimeToDate(todayStart, time);

    const assignedTo =
      patient.assignedCaregiver ||
      fallbackAssignee ||
      undefined;

    const query = {
      patient: patient._id,
      effectiveDate: { $gte: todayStart, $lt: todayEnd },
      'checkinWindows.startTime': time
    };

    const update = {
      $set: {
        title: `${patient.firstName || 'Patient'} ${patient.lastName || ''} visit`.trim(),
        description: `Scheduled visit for ${patient.patientId || 'patient'} (seeded for screenshots).`,
        scheduledFor,
        assignedTo,
        status: 'active',
        effectiveDate: todayNoon,
        recurrence: { pattern: 'once' },
        checkinWindows: [
          {
            name: windowName(time),
            startTime: time,
            endTime: addMinutes(time, durationMinutes),
            gracePeriod: 15,
            required: true,
            days: [],
            assignedCaregiver: assignedTo
          }
        ],
        weeklyActivities: [
          {
            type: 'checkup',
            day,
            time,
            duration: durationMinutes,
            assignedTo,
            notes: 'Generated for demo schedule population.',
            active: true
          }
        ]
      }
    };

    await CareSchedule.updateOne(query, update, { upsert: true });
    upserted += 1;
  }

  const todaysCount = await CareSchedule.countDocuments({ effectiveDate: { $gte: todayStart, $lt: todayEnd } });

  console.log(`Seeded/updated ${upserted} appointment schedules for ${todayStart.toISOString().slice(0, 10)}.`);
  console.log(`Total schedules with effectiveDate today: ${todaysCount}`);

  console.log('[seedTodayAppointments] disconnecting...');
  await mongoose.disconnect().catch(() => {});
  // Ensure the process exits even if a driver handle is still alive.
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
