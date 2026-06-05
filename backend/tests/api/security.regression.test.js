import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import User from '../../models/User.js';
import AuditLog from '../../models/AuditLog.js';

describe('Security regression checks', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/chengeto_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await AuditLog.collection.deleteMany({});
  });

  it('rejects caregiver access to blockchain status', async () => {
    await User.create({
      email: 'caregiver-security@test.com',
      password: 'Test@123456',
      firstName: 'Care',
      lastName: 'Giver',
      phone: '+263771234580',
      role: 'caregiver',
      status: 'active',
      emailVerified: true
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'caregiver-security@test.com', password: 'Test@123456' });

    const token = login.body?.data?.accessToken;
    expect(token).toBeTruthy();

    const response = await request(app)
      .get('/api/v1/blockchain/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.errorCode).toBe('FORBIDDEN');
  });

  it('allows localhost origin by default in test/dev fallback mode', async () => {
    const configuredOrigins = (process.env.CORS_ORIGIN || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const expectedOrigin = configuredOrigins[0] || 'http://localhost';

    const response = await request(app)
      .get('/health')
      .set('Origin', expectedOrigin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(expectedOrigin);
  });

  it('blocks non-allowlisted origins by default', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example');

    expect(response.status).toBe(500);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.body.message).toBe('Not allowed by CORS');
  });

  it('rejects an existing token after account deactivation', async () => {
    const user = await User.create({
      email: 'deactivate-security@test.com',
      password: 'Test@123456',
      firstName: 'Deactivated',
      lastName: 'User',
      phone: '+263771234581',
      role: 'admin',
      status: 'active',
      emailVerified: true
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'deactivate-security@test.com', password: 'Test@123456' });

    const token = login.body?.data?.accessToken;
    expect(token).toBeTruthy();

    user.status = 'inactive';
    await user.save();

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('UNAUTHORIZED');
  });

  it('rejects an old refresh token after a password reset completes', async () => {
    await User.create({
      email: 'reset-refresh@test.com',
      password: 'Test@123456',
      firstName: 'Reset',
      lastName: 'Refresh',
      phone: '+263771234582',
      role: 'admin',
      status: 'active',
      emailVerified: true
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset-refresh@test.com', password: 'Test@123456' });

    const oldRefreshToken = login.body?.data?.refreshToken;
    expect(oldRefreshToken).toBeTruthy();

    const forgotPassword = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset-refresh@test.com' });

    const resetToken = forgotPassword.body?.data?.resetToken;
    expect(resetToken).toBeTruthy();

    const resetPassword = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'NewPass@123456' });

    expect(resetPassword.status).toBe(200);

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(refreshResponse.status).toBe(401);
    expect(refreshResponse.body.message).toBe('Invalid or expired refresh token');
  });

  it('rejects an old refresh token after an authenticated password change', async () => {
    await User.create({
      email: 'change-refresh@test.com',
      password: 'Test@123456',
      firstName: 'Change',
      lastName: 'Refresh',
      phone: '+263771234583',
      role: 'admin',
      status: 'active',
      emailVerified: true
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'change-refresh@test.com', password: 'Test@123456' });

    const accessToken = login.body?.data?.accessToken;
    const oldRefreshToken = login.body?.data?.refreshToken;
    expect(accessToken).toBeTruthy();
    expect(oldRefreshToken).toBeTruthy();

    const changePassword = await request(app)
      .put('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'Test@123456', newPassword: 'BrandNew@123456' });

    expect(changePassword.status).toBe(200);

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(refreshResponse.status).toBe(401);
    expect(refreshResponse.body.message).toBe('Invalid or expired refresh token');
  });

  it('persists password reset audit events with the valid audit schema', async () => {
    await User.create({
      email: 'audit-reset@test.com',
      password: 'Test@123456',
      firstName: 'Audit',
      lastName: 'Reset',
      phone: '+263771234584',
      role: 'admin',
      status: 'active',
      emailVerified: true
    });

    const forgotPassword = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'audit-reset@test.com' });

    const resetToken = forgotPassword.body?.data?.resetToken;
    expect(resetToken).toBeTruthy();

    const resetPassword = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'Another@123456' });

    expect(resetPassword.status).toBe(200);

    const entries = await AuditLog.find({
      action: 'password_change',
      'actor.email': 'audit-reset@test.com'
    }).lean();

    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries.every((entry) => entry.category === 'authentication')).toBe(true);
    expect(entries.every((entry) => entry.result === 'success')).toBe(true);
  });
});
