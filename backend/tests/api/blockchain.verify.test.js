/**
 * CHENGETO Health API Tests - Blockchain integrity verification
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import User from '../../models/User.js';
import Patient from '../../models/Patient.js';
import CheckIn from '../../models/CheckIn.js';

describe('Blockchain Verify API', () => {
  let token;
  let testPatient;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/chengeto_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Patient.deleteMany({}), CheckIn.deleteMany({})]);

    await User.create({
      email: 'admin-blockchain@test.com',
      password: 'Test@123456',
      firstName: 'Admin',
      lastName: 'Verify',
      phone: '+263779998888',
      role: 'admin',
      status: 'active',
      emailVerified: true
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin-blockchain@test.com', password: 'Test@123456' });

    token = login.body?.data?.accessToken;
    expect(token).toBeTruthy();

    const adminUser = await User.findOne({ email: 'admin-blockchain@test.com' }).lean();

    testPatient = await Patient.create({
      patientId: 'PAT-BC-001',
      firstName: 'Block',
      lastName: 'Chain',
      dateOfBirth: new Date('1960-03-15'),
      gender: 'female',
      phone: '+263775556611',
      assignedCHW: adminUser._id,
      primaryCaregiver: adminUser._id,
      address: { village: 'Borrowdale', district: 'Harare', province: 'Harare', country: 'Zimbabwe' },
      emergencyContacts: [
        { name: 'Family Contact', relationship: 'child', phone: '+263773333333', isPrimary: true }
      ],
      status: 'active'
    });
  });

  it('POST /api/v1/blockchain/verify returns a matching off-chain hash for anchored check-ins', async () => {
    const created = await request(app)
      .post('/api/v1/checkins/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: testPatient._id, wellnessScore: 7, notes: 'Routine check-in ok.' });

    expect(created.status).toBe(201);
    const checkInId = created.body?.data?._id;
    expect(checkInId).toBeTruthy();

    const stored = await CheckIn.findById(checkInId).lean();
    expect(stored?.blockchainRecord?.dataHash).toBeTruthy();
    expect(stored?.blockchainRecord?.anchor?.eventType).toBeTruthy();

    const response = await request(app)
      .post('/api/v1/blockchain/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'checkin', id: checkInId });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.offChainCheck.checked).toBe(true);
    expect(response.body.data.offChainCheck.matches).toBe(true);
  });

  it('POST /api/v1/blockchain/verify detects off-chain mismatches when stored hash is tampered', async () => {
    const created = await request(app)
      .post('/api/v1/checkins/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId: testPatient._id, wellnessScore: 5, notes: 'Tamper test.' });

    const checkInId = created.body?.data?._id;
    expect(checkInId).toBeTruthy();

    await CheckIn.updateOne(
      { _id: checkInId },
      { $set: { 'blockchainRecord.dataHash': `0x${'0'.repeat(64)}` } }
    );

    const response = await request(app)
      .post('/api/v1/blockchain/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'checkin', id: checkInId });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.overallStatus).toBe('offchain_mismatch');
    expect(response.body.data.offChainCheck.matches).toBe(false);
  });
});

