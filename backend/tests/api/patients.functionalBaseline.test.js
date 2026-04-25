/**
 * CHENGETO Health API Tests - Patient Functional Baseline
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';

describe('Patients API - Functional Baseline', () => {
  let adminToken;
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
      Patient.deleteMany({})
    ]);

    const hashedPassword = 'Test@123456';

    await User.create({
      email: 'admin@test.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+263771111111',
      role: 'admin',
      status: 'active',
      emailVerified: true
    });

    chwUser = await User.create({
      email: 'chw@test.com',
      password: hashedPassword,
      firstName: 'CHW',
      lastName: 'User',
      phone: '+263771111112',
      role: 'chw',
      status: 'active',
      emailVerified: true
    });

    caregiverUser = await User.create({
      email: 'caregiver@test.com',
      password: hashedPassword,
      firstName: 'Care',
      lastName: 'Giver',
      phone: '+263771111113',
      role: 'caregiver',
      status: 'active',
      emailVerified: true
    });

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: hashedPassword });

    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body?.data?.accessToken;
    expect(adminToken).toBeTruthy();

    testPatient = await Patient.create({
      patientId: 'PAT-FUNC-001',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1950-05-15'),
      gender: 'male',
      phone: '+263772222222',
      primaryCaregiver: caregiverUser._id,
      assignedCHW: chwUser._id,
      emergencyContacts: [
        { name: 'Jane Doe', relationship: 'child', phone: '+263773333333', isPrimary: true }
      ],
      status: 'active'
    });
  });

  it('PUT /api/v1/patients/:id updates functionalBaseline', async () => {
    const response = await request(app)
      .put(`/api/v1/patients/${testPatient._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        functionalBaseline: {
          mobility: 'assisted',
          gait: 'unsteady',
          balance: 'needs_support',
          assistiveDevice: 'walker',
          vision: 'impaired',
          hearing: 'adequate',
          continence: 'occasional_issues',
          weightLossRisk: 'moderate',
          frailty: 'pre_frail',
          homeSafety: 'needs_minor_changes',
          recentFalls: {
            count: 2,
            lastFallAt: '2026-04-01',
            injuryFromLastFall: false
          },
          notes: 'Needs escort outdoors.'
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.functionalBaseline.mobility).toBe('assisted');
    expect(response.body.data.functionalBaseline.assistiveDevice).toBe('walker');
    expect(response.body.data.functionalBaseline.recentFalls.count).toBe(2);
  });
});

