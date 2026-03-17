import request from 'supertest';
import app from '../../src/app.js';
import { _resetFirebaseApp } from '../../src/middleware/auth.js';

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({}),
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn(),
  }),
}));

import * as admin from 'firebase-admin';

describe('Auth Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (admin.apps as unknown[]).length = 0;
    _resetFirebaseApp();
  });

  it('GET /api/v1/me with valid mocked Firebase token returns user profile', async () => {
    const mockDecodedToken = {
      uid: 'integration-user-001',
      email: 'integration@example.com',
      name: 'Integration User',
      picture: 'https://example.com/photo.jpg',
    };

    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(mockDecodedToken),
    });

    const res = await request(app)
      .get('/api/v1/me')
      .set('Authorization', 'Bearer mock-firebase-token')
      .set('x-correlation-id', 'test-correlation-id');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      uid: 'integration-user-001',
      email: 'integration@example.com',
      name: 'Integration User',
    });
    expect(res.headers['x-correlation-id']).toBe('test-correlation-id');
  });
});
