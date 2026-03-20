/**
 * Unit tests for the users controller handlers.
 * Mocks the usersService module to test HTTP layer behaviour in isolation.
 */

jest.mock('../../../src/services/usersService', () => ({
  createUser: jest.fn(),
  getUserByUid: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  listUsers: jest.fn(),
  getUserRoleByEmail: jest.fn(),
  getUserRolesBatch: jest.fn(),
  bootstrapAdminUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/config', () => ({
  config: {
    nodeEnv: 'test',
    logLevel: 'silent',
    port: 8005,
    projectId: 'demo-test',
    allowedOrigins: 'http://localhost:3000',
    adminSheetFileId: undefined,
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

// Mock Firestore and Firebase Admin for app initialisation
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: jest.fn(),
}));

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import * as usersService from '../../../src/services/usersService.js';
import { NotFoundError } from '../../../src/errors.js';

const MOCK_USER = {
  uid: 'uid123',
  email: 'alice@example.com',
  displayName: 'Alice',
  role: 'user',
  disabled: false,
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

      expect(usersService.listUsers).toHaveBeenCalledWith(10, 'tok123');
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
        payload: { email: 'alice@example.com', displayName: 'Alice' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.uid).toBe('uid123');
    });

    it('returns 400 when email is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: { displayName: 'Alice' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when email is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: { email: 'not-an-email' },
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
      const updated = { ...MOCK_USER, displayName: 'Alice Updated' };
      (usersService.updateUser as jest.Mock).mockResolvedValue(updated);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/uid123',
        payload: { displayName: 'Alice Updated' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.displayName).toBe('Alice Updated');
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
        payload: { displayName: 'Name' },
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

  // ── GET /api/v1/users/role?email= ─────────────────────────────────────────

  describe('GET /api/v1/users/role?email=', () => {
    it('returns 200 with role when user has access', async () => {
      (usersService.getUserRoleByEmail as jest.Mock).mockResolvedValue('admin');

      const res = await app.inject({ method: 'GET', url: '/api/v1/users/role?email=alice%40example.com' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.role).toBe('admin');
    });

    it('returns 403 when user has no access (getUserRoleByEmail returns null)', async () => {
      (usersService.getUserRoleByEmail as jest.Mock).mockResolvedValue(null);

      const res = await app.inject({ method: 'GET', url: '/api/v1/users/role?email=no-access%40example.com' });

      expect(res.statusCode).toBe(403);
      expect(res.json().success).toBe(false);
    });
  });

  // ── POST /api/v1/users/roles/batch ────────────────────────────────────────

  describe('POST /api/v1/users/roles/batch', () => {
    it('returns the roles map', async () => {
      (usersService.getUserRolesBatch as jest.Mock).mockResolvedValue({
        uid1: 'admin',
        uid2: 'user',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/roles/batch',
        payload: { uids: ['uid1', 'uid2'] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data['uid1']).toBe('admin');
      expect(body.data['uid2']).toBe('user');
    });

    it('returns 400 when uids is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/roles/batch',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });
});

