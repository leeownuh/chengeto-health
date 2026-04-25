/**
 * CHENGETO Health Integration Tests - Core Workflows (v1)
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';
import Alert from '../../models/Alert.js';

describe('Integration - Core workflows', () => {
  let adminToken;
  let caregiverToken;
  let caregiverUserId;
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
      Alert.deleteMany({})
    ]);

    await User.create({
      email: 'admin@test.com',
      password: 'Test@123456',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+263771111111',
      role: 'admin',
      status: 'active',
      emailVerified: true
    });

    const caregiverUser = await User.create({
      email: 'caregiver@test.com',
      password: 'Test@123456',
      firstName: 'Care',
      lastName: 'Giver',
      phone: '+263771111112',
      role: 'caregiver',
      status: 'active',
      emailVerified: true
    });
    caregiverUserId = caregiverUser._id;

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Test@123456' });
    adminToken = adminLogin.body?.data?.accessToken;
    expect(adminToken).toBeTruthy();

    const caregiverLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'caregiver@test.com', password: 'Test@123456' });
    caregiverToken = caregiverLogin.body?.data?.accessToken;
    expect(caregiverToken).toBeTruthy();

    testPatient = await Patient.create({
      patientId: 'PAT-WF-001',
      firstName: 'Workflow',
      lastName: 'Patient',
      dateOfBirth: new Date('1955-05-20'),
      gender: 'female',
      phone: '+263779990000',
      address: { village: 'Borrowdale', district: 'Harare', province: 'Harare', country: 'Zimbabwe' },
      primaryCaregiver: caregiverUserId,
      assignedCHW: caregiverUserId,
      emergencyContacts: [
        { name: 'Family Contact', relationship: 'child', phone: '+263773333333', isPrimary: true }
      ],
      status: 'active'
    });
  });

  it('caregiver can record a manual check-in and see it in history', async () => {
    const create = await request(app)
      .post('/api/v1/checkins/manual')
      .set('Authorization', `Bearer ${caregiverToken}`)
      .send({
        patientId: testPatient._id,
        wellnessScore: 6,
        notes: 'Home visit completed'
      });

    expect(create.status).toBe(201);
    expect(create.body.success).toBe(true);

    const history = await request(app)
      .get(`/api/v1/checkins/patient/${testPatient._id}/history?limit=5`)
      .set('Authorization', `Bearer ${caregiverToken}`);

    expect(history.status).toBe(200);
    expect(history.body.success).toBe(true);
    expect(Array.isArray(history.body.data.checkIns)).toBe(true);
    expect(history.body.data.checkIns.length).toBeGreaterThanOrEqual(1);
  });

  it('admin can escalate an alert and escalation level increases', async () => {
    const alert = await Alert.create({
      patient: testPatient._id,
      type: 'vital_sign',
      severity: 'critical',
      title: 'Critical vitals',
      message: 'Heart rate above threshold',
      status: 'pending',
      source: { type: 'manual', sensorType: 'vitals' }
    });

    const response = await request(app)
      .put(`/api/v1/alerts/${alert._id}/escalate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'No response from caregiver' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const updated = await Alert.findById(alert._id).lean();
    expect(updated.status).toBe('escalated');
    expect(updated.escalation?.currentLevel ?? 0).toBe(1);
    expect(Array.isArray(updated.escalation?.history)).toBe(true);
    expect(updated.escalation.history.length).toBeGreaterThanOrEqual(1);
  });
});

