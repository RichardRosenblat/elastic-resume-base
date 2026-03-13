import request from 'supertest';
import app from '../../../src/app.js';
import { _resetFirebaseApp } from '../../../src/middleware/auth.js';

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({}),
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn(),
  }),
}));

import * as admin from 'firebase-admin';

describe('ME Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (admin.apps as unknown[]).length = 0;
    _resetFirebaseApp();
  });

  it('GET /api/v1/me returns 200 with user profile when authenticated', async () => {
    const decodedToken = {
      uid: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'http://pic.url',
    };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });

    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      uid: 'user123',
      email: 'test@example.com',
    });
  });

  it('GET /api/v1/me returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
  });
});
