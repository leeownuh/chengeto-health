/**
 * CHENGETO Health API Tests - Check-ins (v1)
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';
import CheckIn from '../../models/CheckIn.js';

describe('Check-ins API', () => {
  let token;
  let testPatient;
  let caregiverUserId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/chengeto_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Patient.deleteMany({}), CheckIn.deleteMany({})]);

    const caregiverUser = await User.create({
      email: 'caregiver@test.com',
      password: 'Test@123456',
      firstName: 'Care',
      lastName: 'Giver',
      phone: '+263772223333',
      role: 'caregiver',
      status: 'active',
      emailVerified: true
    });
    caregiverUserId = caregiverUser._id;

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'caregiver@test.com', password: 'Test@123456' });

    token = login.body?.data?.accessToken;
    expect(token).toBeTruthy();

    testPatient = await Patient.create({
      patientId: 'PAT-CHK-001',
      firstName: 'CheckIn',
      lastName: 'Patient',
      dateOfBirth: new Date('1960-03-15'),
      gender: 'male',
      phone: '+263775556666',
      assignedCHW: caregiverUserId,
      primaryCaregiver: caregiverUserId,
      address: { village: 'Borrowdale', district: 'Harare', province: 'Harare', country: 'Zimbabwe' },
      emergencyContacts: [
        { name: 'Family Contact', relationship: 'child', phone: '+263773333333', isPrimary: true }
      ],
      status: 'active'
    });
  });

  it('POST /api/v1/checkins/manual records a completed manual check-in', async () => {
    const response = await request(app)
      .post('/api/v1/checkins/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: testPatient._id,
        wellnessScore: 7,
        notes: 'Routine check-in ok.',
        location: { latitude: -17.8292, longitude: 31.0534, accuracy: 12 },
        vitals: { heartRate: 72, systolic: 120, diastolic: 80, temperature: 36.8, spo2: 98 }
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('completed');
    expect(response.body.data.patient).toBeTruthy();
  });

  it('GET /api/v1/checkins/patient/:patientId/history returns completed check-ins', async () => {
    await request(app)
      .post('/api/v1/checkins/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: testPatient._id, wellnessScore: 6, notes: 'First check' });

    const response = await request(app)
      .get(`/api/v1/checkins/patient/${testPatient._id}/history?limit=10`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.checkIns)).toBe(true);
    expect(response.body.data.checkIns.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/checkins/:id returns check-in details', async () => {
    const created = await request(app)
      .post('/api/v1/checkins/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: testPatient._id, wellnessScore: 8, notes: 'Detail check' });

    const checkInId = created.body?.data?._id;
    expect(checkInId).toBeTruthy();

    const response = await request(app)
      .get(`/api/v1/checkins/${checkInId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data._id).toBe(checkInId);
  });

  it('GET /api/v1/checkins/:id returns 404 for missing check-in', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .get(`/api/v1/checkins/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});
