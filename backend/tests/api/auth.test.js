/**
 * CHENGETO Health API Tests - Authentication (v1)
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server.js';
import User from '../../models/User.js';

describe('Authentication API', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/chengeto_test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  it('POST /api/v1/auth/login returns an access token for active users', async () => {
    await User.create({
      email: 'login@example.com',
      password: 'Test@123456',
      firstName: 'Login',
      lastName: 'User',
      phone: '+263771234567',
      role: 'caregiver',
      status: 'active',
      emailVerified: true
    });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: 'Test@123456' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.user.email).toBe('login@example.com');
  });

  it('GET /api/v1/auth/me returns the current user', async () => {
    await User.create({
      email: 'me@example.com',
      password: 'Test@123456',
      firstName: 'Me',
      lastName: 'User',
      phone: '+263771234568',
      role: 'admin',
      status: 'active',
      emailVerified: true
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'me@example.com', password: 'Test@123456' });

    const token = login.body?.data?.accessToken;

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('me@example.com');
  });
});

