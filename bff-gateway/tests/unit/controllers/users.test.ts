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

jest.mock('../../../src/services/usersService', () => ({
  getUserByUid: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  listUsers: jest.fn(),
  getPreApproved: jest.fn(),
  listPreApproved: jest.fn(),
  addPreApproved: jest.fn(),
  deletePreApproved: jest.fn(),
  updatePreApproved: jest.fn(),
}));

jest.mock('../../../src/services/userApiClient', () => ({
  authorizeUser: jest.fn().mockResolvedValue({ role: 'admin', enable: true }),
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
import * as usersService from '../../../src/services/usersService.js';
import { ForbiddenError, NotFoundError } from '../../../src/errors.js';

const mockUser = {
  uid: 'uid123',
  email: 'test@example.com',
  role: 'user',
  enable: true,
};

const mockPreApproved = {
  email: 'test@example.com',
  role: 'admin',
};

function setupAuth(uid = 'admin-uid') {
  (admin.auth as jest.Mock).mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid, email: `${uid}@example.com` }),
  });
}

describe('Users Controller', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    (admin.apps as unknown[]).length = 0;
    _resetFirebaseApp();
    setupAuth();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (admin.apps as unknown[]).length = 0;
    _resetFirebaseApp();
    setupAuth();
  });

  describe('GET /api/v1/users/:uid', () => {
    it('returns 200 on success', async () => {
      (usersService.getUserByUid as jest.Mock).mockResolvedValue(mockUser);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/uid123',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ uid: 'uid123', email: 'test@example.com' });
    });

    it('returns 404 when NotFoundError thrown', async () => {
      (usersService.getUserByUid as jest.Mock).mockRejectedValue(new NotFoundError('User uid123 not found'));

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/uid123',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/users/uid123' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/v1/users/:uid', () => {
    it('returns 200 on success', async () => {
      const updated = { ...mockUser, email: 'updated@example.com' };
      (usersService.updateUser as jest.Mock).mockResolvedValue(updated);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/uid123',
        headers: { authorization: 'Bearer valid-token' },
        payload: { email: 'updated@example.com' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('updated@example.com');
    });

    it('returns 403 when service throws ForbiddenError', async () => {
      (usersService.updateUser as jest.Mock).mockRejectedValue(
        new ForbiddenError('You may only update your own profile'),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/other-uid',
        headers: { authorization: 'Bearer valid-token' },
        payload: { role: 'admin' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/uid123',
        payload: { email: 'test@example.com' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/v1/users/:uid', () => {
    it('returns 204 on success', async () => {
      (usersService.deleteUser as jest.Mock).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/uid123',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(204);
    });

    it('returns 403 when service throws ForbiddenError', async () => {
      (usersService.deleteUser as jest.Mock).mockRejectedValue(new ForbiddenError('Admin access required'));

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/uid123',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/v1/users/uid123' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/users', () => {
    it('returns 200 with users list', async () => {
      (usersService.listUsers as jest.Mock).mockResolvedValue({ users: [mockUser], pageToken: undefined });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.users).toHaveLength(1);
      expect(body.data.users[0]).toMatchObject({ uid: 'uid123' });
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/users' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/users/pre-approve', () => {
    it('returns 200 with list of pre-approved users', async () => {
      (usersService.listPreApproved as jest.Mock).mockResolvedValue([mockPreApproved]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/pre-approve',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/users/pre-approve' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/users/pre-approve', () => {
    it('returns 201 on success', async () => {
      (usersService.addPreApproved as jest.Mock).mockResolvedValue(mockPreApproved);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/pre-approve',
        headers: { authorization: 'Bearer valid-token' },
        payload: { email: 'test@example.com', role: 'admin' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.email).toBe('test@example.com');
    });

    it('returns 400 on invalid email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/pre-approve',
        headers: { authorization: 'Bearer valid-token' },
        payload: { email: 'not-an-email', role: 'admin' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v1/users/pre-approve', () => {
    it('returns 204 on success', async () => {
      (usersService.deletePreApproved as jest.Mock).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/pre-approve?email=test%40example.com',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(204);
    });

    it('returns 400 when email is missing', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/pre-approve',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
