/**
 * Unit tests for the users controller handlers.
 * Mocks the usersService and preApprovedUsersService modules to test HTTP layer behaviour.
 */

jest.mock('../../../src/services/usersService', () => ({
  authorizeUser: jest.fn(),
  createUser: jest.fn(),
  getUserByUid: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  listUsers: jest.fn(),
  bootstrapAdminUser: jest.fn(),
}));

jest.mock('../../../src/services/preApprovedUsersService', () => ({
  getPreApprovedUser: jest.fn(),
  listPreApprovedUsers: jest.fn(),
  addToPreApproved: jest.fn(),
  deleteFromPreApproved: jest.fn(),
  updatePreApproved: jest.fn(),
}));

jest.mock('../../../src/config', () => ({
  config: {
    nodeEnv: 'test',
    logLevel: 'silent',
    port: 8005,
    projectId: 'demo-test',
    allowedOrigins: 'http://localhost:3000',
    firestoreUsersCollection: 'users',
    firestorePreApprovedUsersCollection: 'pre_approved_users',
    onboardableEmailDomains: '',
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import * as usersService from '../../../src/services/usersService.js';
import * as preApprovedService from '../../../src/services/preApprovedUsersService.js';
import { NotFoundError, ForbiddenError } from '../../../src/errors.js';

const MOCK_USER = {
  uid: 'uid123',
  email: 'alice@example.com',
  role: 'user',
  enable: true,
};

const MOCK_PRE_APPROVED = {
  email: 'alice@example.com',
  role: 'admin',
};

describe('users controller', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/v1/users/authorize ────────────────────────────────────────────

  describe('POST /api/v1/users/authorize', () => {
    it('returns 200 with role and enable when user is authorized', async () => {
      (usersService.authorizeUser as jest.Mock).mockResolvedValue({ role: 'user', enable: true });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/authorize',
        payload: { uid: 'uid123', email: 'alice@example.com' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.role).toBe('user');
      expect(body.data.enable).toBe(true);
    });

    it('returns 403 when user is forbidden', async () => {
      (usersService.authorizeUser as jest.Mock).mockRejectedValue(
        new ForbiddenError('User does not have access to this application'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/authorize',
        payload: { uid: 'uid123', email: 'blocked@example.com' },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when uid is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/authorize',
        payload: { email: 'alice@example.com' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when email is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/authorize',
        payload: { uid: 'uid123', email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /api/v1/users ──────────────────────────────────────────────────────

  describe('GET /api/v1/users', () => {
    it('returns 200 with user list', async () => {
      (usersService.listUsers as jest.Mock).mockResolvedValue({
        users: [MOCK_USER],
        pageToken: undefined,
      });

      const res = await app.inject({ method: 'GET', url: '/api/v1/users' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.users).toHaveLength(1);
    });

    it('passes maxResults and pageToken query params to service', async () => {
      (usersService.listUsers as jest.Mock).mockResolvedValue({ users: [], pageToken: undefined });

      await app.inject({ method: 'GET', url: '/api/v1/users?maxResults=10&pageToken=tok123' });

      expect(usersService.listUsers).toHaveBeenCalledWith(10, 'tok123', undefined);
    });

    it('returns 400 when maxResults is invalid', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/users?maxResults=0' });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /api/v1/users ─────────────────────────────────────────────────────

  describe('POST /api/v1/users', () => {
    it('returns 201 with the created user', async () => {
      (usersService.createUser as jest.Mock).mockResolvedValue(MOCK_USER);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: { uid: 'uid123', email: 'alice@example.com' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.uid).toBe('uid123');
    });

    it('returns 400 when uid is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: { email: 'alice@example.com' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when email is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: { uid: 'uid123', email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /api/v1/users/:uid ─────────────────────────────────────────────────

  describe('GET /api/v1/users/:uid', () => {
    it('returns 200 with the user record', async () => {
      (usersService.getUserByUid as jest.Mock).mockResolvedValue(MOCK_USER);

      const res = await app.inject({ method: 'GET', url: '/api/v1/users/uid123' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.uid).toBe('uid123');
    });

    it('returns 404 when user is not found', async () => {
      (usersService.getUserByUid as jest.Mock).mockRejectedValue(
        new NotFoundError('User not found'),
      );

      const res = await app.inject({ method: 'GET', url: '/api/v1/users/missing-uid' });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── PATCH /api/v1/users/:uid ───────────────────────────────────────────────

  describe('PATCH /api/v1/users/:uid', () => {
    it('returns 200 with the updated user', async () => {
      const updated = { ...MOCK_USER, enable: false };
      (usersService.updateUser as jest.Mock).mockResolvedValue(updated);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/uid123',
        payload: { enable: false },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.enable).toBe(false);
    });

    it('returns 400 when payload is invalid', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/uid123',
        payload: { email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 when user does not exist', async () => {
      (usersService.updateUser as jest.Mock).mockRejectedValue(
        new NotFoundError('User not found'),
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/missing-uid',
        payload: { role: 'admin' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── DELETE /api/v1/users/:uid ──────────────────────────────────────────────

  describe('DELETE /api/v1/users/:uid', () => {
    it('returns 204 on successful deletion', async () => {
      (usersService.deleteUser as jest.Mock).mockResolvedValue(undefined);

      const res = await app.inject({ method: 'DELETE', url: '/api/v1/users/uid123' });
      expect(res.statusCode).toBe(204);
    });

    it('returns 404 when user does not exist', async () => {
      (usersService.deleteUser as jest.Mock).mockRejectedValue(
        new NotFoundError('User not found'),
      );

      const res = await app.inject({ method: 'DELETE', url: '/api/v1/users/missing-uid' });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /api/v1/users/pre-approve ─────────────────────────────────────────

  describe('GET /api/v1/users/pre-approve', () => {
    it('returns 200 with list of pre-approved users', async () => {
      (preApprovedService.listPreApprovedUsers as jest.Mock).mockResolvedValue([MOCK_PRE_APPROVED]);

      const res = await app.inject({ method: 'GET', url: '/api/v1/users/pre-approve' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe('alice@example.com');
    });

    it('returns 200 with a specific pre-approved user when email is provided', async () => {
      (preApprovedService.getPreApprovedUser as jest.Mock).mockResolvedValue(MOCK_PRE_APPROVED);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/pre-approve?email=alice%40example.com',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.email).toBe('alice@example.com');
    });

    it('returns 404 when specific pre-approved user is not found', async () => {
      (preApprovedService.getPreApprovedUser as jest.Mock).mockRejectedValue(
        new NotFoundError('Not found'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/pre-approve?email=nobody%40example.com',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /api/v1/users/pre-approve ────────────────────────────────────────

  describe('POST /api/v1/users/pre-approve', () => {
    it('returns 201 with the created pre-approved user', async () => {
      (preApprovedService.addToPreApproved as jest.Mock).mockResolvedValue(MOCK_PRE_APPROVED);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/pre-approve',
        payload: { email: 'alice@example.com', role: 'admin' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.email).toBe('alice@example.com');
      expect(body.data.role).toBe('admin');
    });

    it('returns 400 when email is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/pre-approve',
        payload: { role: 'admin' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── DELETE /api/v1/users/pre-approve?email= ───────────────────────────────

  describe('DELETE /api/v1/users/pre-approve', () => {
    it('returns 204 on successful deletion', async () => {
      (preApprovedService.deleteFromPreApproved as jest.Mock).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/pre-approve?email=alice%40example.com',
      });
      expect(res.statusCode).toBe(204);
    });

    it('returns 400 when email is missing', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/v1/users/pre-approve' });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 when pre-approved user is not found', async () => {
      (preApprovedService.deleteFromPreApproved as jest.Mock).mockRejectedValue(
        new NotFoundError('Not found'),
      );

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/pre-approve?email=nobody%40example.com',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── PATCH /api/v1/users/pre-approve?email= ────────────────────────────────

  describe('PATCH /api/v1/users/pre-approve', () => {
    it('returns 200 with the updated pre-approved user', async () => {
      const updated = { email: 'alice@example.com', role: 'user' };
      (preApprovedService.updatePreApproved as jest.Mock).mockResolvedValue(updated);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/pre-approve?email=alice%40example.com',
        payload: { role: 'user' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.role).toBe('user');
    });

    it('returns 400 when email is missing', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/pre-approve',
        payload: { role: 'user' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
