import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
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
  let app: FastifyInstance;

  beforeAll(async () => {
    (admin.apps as unknown[]).length = 0;
    _resetFirebaseApp();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

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

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data).toMatchObject({
      uid: 'user123',
      email: 'test@example.com',
    });
  });

  it('GET /api/v1/me returns 401 when not authenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(res.statusCode).toBe(401);
  });
});
