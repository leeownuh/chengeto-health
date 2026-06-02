import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import User from '../../models/User.js';

describe('Security regression checks', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/chengeto_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
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
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost');
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
});
