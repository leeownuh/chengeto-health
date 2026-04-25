/**
 * CHENGETO Health API Tests - Patients (compat list, v1 mount)
 *
 * Note: `/api/v1/patients` is currently served by `patient.compat.routes.js` first.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';

describe('Patients API', () => {
  let adminToken;
  let caregiverUser;
  let chwUser;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/chengeto_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Patient.deleteMany({})]);

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

    chwUser = await User.create({
      email: 'chw@test.com',
      password: 'Test@123456',
      firstName: 'CHW',
      lastName: 'User',
      phone: '+263771111112',
      role: 'chw',
      status: 'active',
      emailVerified: true
    });

    caregiverUser = await User.create({
      email: 'caregiver@test.com',
      password: 'Test@123456',
      firstName: 'Care',
      lastName: 'Giver',
      phone: '+263771111113',
      role: 'caregiver',
      status: 'active',
      emailVerified: true
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Test@123456' });

    adminToken = login.body?.data?.accessToken;
    expect(adminToken).toBeTruthy();

    await Patient.create({
      patientId: 'PAT-LIST-001',
      firstName: 'Chengetai',
      lastName: 'Moyo',
      dateOfBirth: new Date('1950-05-15'),
      gender: 'female',
      phone: '+263772222222',
      address: { village: 'Borrowdale', district: 'Harare', province: 'Harare', country: 'Zimbabwe' },
      primaryCaregiver: caregiverUser._id,
      assignedCHW: chwUser._id,
      emergencyContacts: [
        { name: 'Family Contact', relationship: 'child', phone: '+263773333333', isPrimary: true }
      ],
      status: 'active',
      functionalBaseline: {
        mobility: 'assisted',
        gait: 'slow',
        balance: 'needs_support',
        assistiveDevice: 'cane',
        vision: 'adequate',
        hearing: 'adequate',
        continence: 'independent',
        weightLossRisk: 'low',
        frailty: 'pre_frail',
        homeSafety: 'needs_minor_changes',
        recentFalls: { count: 1 }
      }
    });
  });

  it('GET /api/v1/patients returns a paginated patient list', async () => {
    const response = await request(app)
      .get('/api/v1/patients?limit=10&page=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.patients)).toBe(true);
    expect(response.body.data.patients.length).toBeGreaterThanOrEqual(1);
  });
});

