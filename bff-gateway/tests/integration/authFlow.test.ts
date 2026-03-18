import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { _resetFirebaseApp } from '../../src/middleware/auth.js';

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({}),
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn(),
  }),
}));

jest.mock('../../src/services/userApiClient', () => ({
  checkUserAccess: jest.fn().mockResolvedValue('user'),
  getUserRole: jest.fn(),
  getUserRolesBatch: jest.fn(),
}));

import * as admin from 'firebase-admin';

describe('Auth Flow Integration', () => {
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

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: {
        authorization: 'Bearer mock-firebase-token',
        'x-correlation-id': 'test-correlation-id',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      uid: 'integration-user-001',
      email: 'integration@example.com',
      name: 'Integration User',
    });
    expect(res.headers['x-correlation-id']).toBe('test-correlation-id');
  });
});
