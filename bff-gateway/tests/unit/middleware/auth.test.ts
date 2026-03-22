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
  authorizeUser: jest.fn(),
  getUserById: jest.fn(),
  listUsersFromApi: jest.fn(),
  updateUserInApi: jest.fn(),
  deleteUserFromApi: jest.fn(),
  listPreApprovedFromApi: jest.fn(),
  getPreApprovedFromApi: jest.fn(),
  addPreApprovedInApi: jest.fn(),
  deletePreApprovedFromApi: jest.fn(),
  updatePreApprovedInApi: jest.fn(),
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
    // Default: UserAPI grants access with enable=true
    (userApiClient.authorizeUser as jest.Mock).mockResolvedValue({ role: 'user', enable: true });
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

  it('proceeds and sets request.user when token is valid and user has access (enable=true)', async () => {
    const decodedToken = { uid: 'user123', email: 'test@example.com', name: 'Test User', picture: 'http://pic.url' };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });
    (userApiClient.authorizeUser as jest.Mock).mockResolvedValue({ role: 'user', enable: true });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.uid).toBe('user123');
    expect(userApiClient.authorizeUser as jest.Mock).toHaveBeenCalledWith('user123', 'test@example.com');
  });

  it('returns 403 with pending approval message when enable=false', async () => {
    const decodedToken = { uid: 'pending-uid', email: 'pending@example.com', name: 'Pending User', picture: '' };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });
    (userApiClient.authorizeUser as jest.Mock).mockResolvedValue({ role: 'user', enable: false });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token-pending' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    expect(res.json().error.message).toContain('pending approval');
  });

  it('returns 403 when token is valid but user is not authorized (ForbiddenError)', async () => {
    const decodedToken = { uid: 'unregistered-uid', email: 'ghost@example.com', name: 'Ghost', picture: '' };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });
    (userApiClient.authorizeUser as jest.Mock).mockRejectedValue(
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

  it('returns 403 when token has no email', async () => {
    const decodedToken = { uid: 'user-no-email' }; // no email
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer no-email-token' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });
});

// Export authHook for completeness
export { authHook };
