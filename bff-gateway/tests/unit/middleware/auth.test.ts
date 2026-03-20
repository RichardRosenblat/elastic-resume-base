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
  getUserById: jest.fn(),
  createUserInUsersApi: jest.fn(),
  getAllowlistEntry: jest.fn(),
  deleteAllowlistEntry: jest.fn(),
  upsertAllowlistEntry: jest.fn(),
}));

import * as admin from 'firebase-admin';
import * as userApiClient from '../../../src/services/userApiClient.js';
import { ForbiddenError, NotFoundError, UnavailableError } from '../../../src/errors.js';

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
    // Default: user exists and is enabled
    (userApiClient.getUserById as jest.Mock).mockResolvedValue({
      uid: 'user123',
      email: 'test@example.com',
      role: 'user',
      enabled: true,
      disabled: false,
    });
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
    const decodedToken = {
      uid: 'user123',
      email: 'test@example.com',
      email_verified: true,
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
    expect(res.json().data.uid).toBe('user123');
    expect(userApiClient.getUserById as jest.Mock).toHaveBeenCalledWith('user123');
  });

  it('returns 403 when token is valid but user account is disabled', async () => {
    const decodedToken = {
      uid: 'disabled-uid',
      email: 'disabled@example.com',
      email_verified: true,
      name: 'Disabled User',
      picture: '',
    };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });
    (userApiClient.getUserById as jest.Mock).mockResolvedValue({
      uid: 'disabled-uid',
      email: 'disabled@example.com',
      role: 'user',
      enabled: false,
      disabled: true,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token-disabled' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('returns 403 when token is valid but user is not in Users collection or allowlist', async () => {
    const decodedToken = {
      uid: 'unregistered-uid',
      email: 'ghost@example.com',
      email_verified: true,
      name: 'Ghost',
      picture: '',
    };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });
    (userApiClient.getUserById as jest.Mock).mockRejectedValue(
      new NotFoundError('User not found'),
    );
    (userApiClient.getAllowlistEntry as jest.Mock).mockRejectedValue(
      new NotFoundError('No allowlist entry'),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token-unregistered' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('provisions user from allowlist and grants access on first login', async () => {
    const decodedToken = {
      uid: 'new-uid',
      email: 'newuser@example.com',
      email_verified: true,
      name: 'New User',
      picture: '',
    };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });
    (userApiClient.getUserById as jest.Mock).mockRejectedValue(
      new NotFoundError('User not found'),
    );
    (userApiClient.getAllowlistEntry as jest.Mock).mockResolvedValue({
      email: 'newuser@example.com',
      role: 'admin',
    });
    (userApiClient.createUserInUsersApi as jest.Mock).mockResolvedValue({
      uid: 'new-uid',
      email: 'newuser@example.com',
      role: 'admin',
      enabled: true,
      disabled: false,
    });
    (userApiClient.deleteAllowlistEntry as jest.Mock).mockResolvedValue(undefined);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token-new-user' },
    });
    expect(res.statusCode).toBe(200);
    expect(userApiClient.createUserInUsersApi as jest.Mock).toHaveBeenCalledWith({
      uid: 'new-uid',
      email: 'newuser@example.com',
      role: 'admin',
      enabled: true,
    });
    expect(userApiClient.deleteAllowlistEntry as jest.Mock).toHaveBeenCalledWith('newuser@example.com');
  });

  it('returns 503 when Users API is unavailable (fail-closed)', async () => {
    const decodedToken = {
      uid: 'user123',
      email: 'test@example.com',
      email_verified: true,
      name: 'Test User',
      picture: 'http://pic.url',
    };
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
    });
    (userApiClient.getUserById as jest.Mock).mockRejectedValue(
      new UnavailableError('UserAPI unreachable'),
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(503);
  });
});

// Export authHook for completeness (was previously imported but not used directly)
export { authHook };

