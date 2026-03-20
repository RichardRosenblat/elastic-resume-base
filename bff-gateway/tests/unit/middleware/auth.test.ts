import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { authHook, _resetFirebaseApp } from '../../../src/middleware/auth.js';

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({}),
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn(),
  }),
}));

jest.mock('../../../src/services/userApiClient', () => ({
  checkUserAccess: jest.fn(),
  getUserRole: jest.fn(),
  getUserRolesBatch: jest.fn(),
}));

import * as admin from 'firebase-admin';
import * as userApiClient from '../../../src/services/userApiClient.js';
import { ForbiddenError } from '../../../src/errors.js';

describe('authHook', () => {
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
    // Default: UserAPI grants access
    (userApiClient.checkUserAccess as jest.Mock).mockResolvedValue('user');
  });

  it('returns 401 when no Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Basic sometoken' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when token verification fails', async () => {
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockRejectedValue(new Error('Invalid token')),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('proceeds and sets request.user when token is valid and user has access', async () => {
    const decodedToken = { uid: 'user123', email: 'test@example.com', name: 'Test User', picture: 'http://pic.url' };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.uid).toBe('user123');
    expect(userApiClient.checkUserAccess as jest.Mock).toHaveBeenCalledWith('test@example.com');
  });

  it('returns 403 when token is valid but user is not a valid application user', async () => {
    const decodedToken = { uid: 'unregistered-uid', email: 'ghost@example.com', name: 'Ghost', picture: '' };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });
    (userApiClient.checkUserAccess as jest.Mock).mockRejectedValue(
      new ForbiddenError('User does not have access to this application'),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token-unregistered' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('proceeds when UserAPI is unavailable (graceful degradation)', async () => {
    const decodedToken = { uid: 'user123', email: 'test@example.com', name: 'Test User', picture: 'http://pic.url' };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });
    // checkUserAccess falls back to 'user' on network errors (no throw)
    (userApiClient.checkUserAccess as jest.Mock).mockResolvedValue('user');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(200);
  });
});

// Export authHook for completeness (was previously imported but not used directly)
export { authHook };
