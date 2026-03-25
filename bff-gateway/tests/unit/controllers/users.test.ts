import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { _setTokenVerifier, _resetTokenVerifier } from '../../../src/middleware/auth.js';

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

import * as usersService from '../../../src/services/usersService.js';
import { ForbiddenError, NotFoundError, RateLimitError } from '../../../src/errors.js';

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

const mockVerifier = { verifyToken: jest.fn() };

function setupAuth(uid = 'admin-uid') {
  mockVerifier.verifyToken.mockResolvedValue({ uid, email: `${uid}@example.com` });
}

describe('Users Controller', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    _setTokenVerifier(mockVerifier);
    setupAuth();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    _resetTokenVerifier();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  describe('GET /api/v1/users/me', () => {
    it('returns 200 with current user profile', async () => {
      (usersService.getUserByUid as jest.Mock).mockResolvedValue(mockUser);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ uid: 'uid123', email: 'test@example.com' });
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/users/me' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('returns 200 on successful self-update', async () => {
      const updated = { ...mockUser, email: 'updated@example.com' };
      (usersService.updateUser as jest.Mock).mockResolvedValue(updated);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: { authorization: 'Bearer valid-token' },
        payload: { email: 'updated@example.com' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('updated@example.com');
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        payload: { email: 'test@example.com' },
      });
      expect(res.statusCode).toBe(401);
    });
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

    it('returns 400 when payload is empty', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/uid123',
        headers: { authorization: 'Bearer valid-token' },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
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

    it('returns 404 when service throws NotFoundError', async () => {
      (usersService.deleteUser as jest.Mock).mockRejectedValue(new NotFoundError('User not found'));

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/uid123',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(404);
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

    it('passes role filter to service', async () => {
      (usersService.listUsers as jest.Mock).mockResolvedValue({ users: [mockUser], pageToken: undefined });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users?role=admin',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(usersService.listUsers).toHaveBeenCalledWith(
        expect.any(Number),
        undefined,
        { role: 'admin' },
      );
    });

    it('passes enable filter to service', async () => {
      (usersService.listUsers as jest.Mock).mockResolvedValue({ users: [mockUser], pageToken: undefined });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users?enable=false',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(usersService.listUsers).toHaveBeenCalledWith(
        expect.any(Number),
        undefined,
        { enable: false },
      );
    });

    it('returns 400 when enable is invalid (not true or false)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users?enable=invalid',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('enable');
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

    it('returns 400 when role is invalid (not admin or user)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/pre-approve',
        headers: { authorization: 'Bearer valid-token' },
        payload: { email: 'test@example.com', role: 'superuser' },
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

    it('returns 404 when service throws NotFoundError', async () => {
      (usersService.deletePreApproved as jest.Mock).mockRejectedValue(new NotFoundError('Pre-approved user not found'));

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/pre-approve?email=missing%40example.com',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/v1/users/pre-approve', () => {
    it('returns 200 on success', async () => {
      (usersService.updatePreApproved as jest.Mock).mockResolvedValue({ email: 'test@example.com', role: 'user' });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/pre-approve?email=test%40example.com',
        headers: { authorization: 'Bearer valid-token' },
        payload: { role: 'user' },
      });

      expect(res.statusCode).toBe(200);
    });

    it('returns 400 when body is empty', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/pre-approve?email=test%40example.com',
        headers: { authorization: 'Bearer valid-token' },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when role is invalid', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/pre-approve?email=test%40example.com',
        headers: { authorization: 'Bearer valid-token' },
        payload: { role: 'superuser' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when email query param is missing', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/pre-approve',
        headers: { authorization: 'Bearer valid-token' },
        payload: { role: 'user' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/users/pre-approve with role filter', () => {
    it('passes role filter to service', async () => {
      (usersService.listPreApproved as jest.Mock).mockResolvedValue([mockPreApproved]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/pre-approve?role=admin',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(usersService.listPreApproved).toHaveBeenCalledWith(
        expect.any(String),
        { role: 'admin' },
      );
    });
  });

  describe('Rate limit propagation', () => {
    it('returns 429 with RATE_LIMIT_EXCEEDED when service throws RateLimitError', async () => {
      (usersService.getUserByUid as jest.Mock).mockRejectedValue(
        new RateLimitError('Too many requests. Please wait a moment and try again.'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json<{ success: boolean; error: { code: string; message: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('returns 429 when listUsers service throws RateLimitError', async () => {
      (usersService.listUsers as jest.Mock).mockRejectedValue(
        new RateLimitError(),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(429);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
