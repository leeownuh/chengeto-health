/**
 * CHENGETO Health API Tests - Alerts (compat list, v1 mount)
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';
import Alert from '../../models/Alert.js';

describe('Alerts API', () => {
  let caregiverToken;
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
    await Promise.all([User.deleteMany({}), Patient.deleteMany({}), Alert.deleteMany({})]);

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

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'caregiver@test.com', password: 'Test@123456' });

    caregiverToken = login.body?.data?.accessToken;
    expect(caregiverToken).toBeTruthy();

    testPatient = await Patient.create({
      patientId: 'PAT-ALERT-001',
      firstName: 'Rutendo',
      lastName: 'Chiwenga',
      dateOfBirth: new Date('1944-01-27'),
      gender: 'female',
      phone: '+263772222223',
      primaryCaregiver: caregiverUser._id,
      assignedCHW: chwUser._id,
      emergencyContacts: [
        { name: 'Family Contact', relationship: 'child', phone: '+263773333334', isPrimary: true }
      ],
      status: 'active'
    });

    await Alert.create({
      patient: testPatient._id,
      type: 'fall_detected',
      severity: 'high',
      title: 'Possible fall detected',
      message: 'Wearable recorded an impact pattern consistent with a fall.',
      status: 'pending',
      source: { type: 'sensor', sensorType: 'accelerometer', triggerValue: { impactForce: 2.5 } }
    });
  });

  it('GET /api/v1/alerts returns alerts list', async () => {
    const response = await request(app)
      .get('/api/v1/alerts?limit=10&page=1')
      .set('Authorization', `Bearer ${caregiverToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.alerts)).toBe(true);
    expect(response.body.data.alerts.length).toBeGreaterThanOrEqual(1);
  });
});

