/**
 * CHENGETO Health API Tests - Schedules (canonical)
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';
import CareSchedule from '../../models/CareSchedule.js';

describe('Schedules API', () => {
  let token;
  let caregiverUser;
  let chwUser;
  let testPatient;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/chengeto_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      CareSchedule.deleteMany({})
    ]);

    caregiverUser = await User.create({
      email: 'caregiver@test.com',
      password: 'Test@123456',
      firstName: 'Care',
      lastName: 'Giver',
      phone: '+263771234567',
      role: 'caregiver',
      status: 'active',
      emailVerified: true
    });

    chwUser = await User.create({
      email: 'chw@test.com',
      password: 'Test@123456',
      firstName: 'CHW',
      lastName: 'User',
      phone: '+263771234568',
      role: 'chw',
      status: 'active',
      emailVerified: true
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'caregiver@test.com', password: 'Test@123456' });

    expect(loginRes.status).toBe(200);
    token = loginRes.body?.data?.accessToken;
    expect(token).toBeTruthy();

    testPatient = await Patient.create({
      patientId: 'PAT-TEST-001',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1950-05-15'),
      gender: 'male',
      phone: '+263771111111',
      primaryCaregiver: caregiverUser._id,
      assignedCHW: chwUser._id,
      emergencyContacts: [
        {
          name: 'Jane Doe',
          relationship: 'child',
          phone: '+263772222222',
          isPrimary: true
        }
      ]
    });

    await CareSchedule.create({
      patient: testPatient._id,
      status: 'active',
      effectiveDate: new Date(),
      checkinWindows: [
        {
          name: 'morning',
          startTime: '09:00',
          endTime: '09:30',
          required: true,
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      ],
      weeklyActivities: [
        {
          type: 'checkup',
          day: 'monday',
          time: '09:00',
          duration: 30,
          assignedTo: caregiverUser._id,
          active: true
        }
      ],
      createdBy: caregiverUser._id,
      lastModifiedBy: caregiverUser._id
    });
  });

  it('GET /api/v1/schedules returns schedules for accessible patients', async () => {
    const response = await request(app)
      .get('/api/v1/schedules')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.schedules)).toBe(true);
    expect(response.body.data.schedules.length).toBeGreaterThanOrEqual(1);

    const first = response.body.data.schedules[0];
    expect(first.patient).toBeTruthy();
    expect(first.patient.name).toBeTruthy();
  });

  it('PUT /api/v1/schedules/:id updates a schedule and returns UI-friendly type', async () => {
    const list = await request(app)
      .get('/api/v1/schedules')
      .set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    const scheduleId = list.body?.data?.schedules?.[0]?._id;
    expect(scheduleId).toBeTruthy();

    const updateRes = await request(app)
      .put(`/api/v1/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Medication check - morning',
        patientId: testPatient._id.toString(),
        date: new Date().toISOString().split('T')[0],
        time: '07:45',
        duration: 15,
        type: 'medication',
        notes: 'Confirm dose taken and note side effects.',
        recurring: true,
        recurringPattern: 'weekly'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body?._id).toBe(scheduleId);
    expect(updateRes.body?.type).toBe('medication');
    expect(updateRes.body?.time).toBe('07:45');
  });
});
