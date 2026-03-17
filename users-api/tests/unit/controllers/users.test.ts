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
  getUserRole: jest.fn(),
  getUserRolesBatch: jest.fn(),
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

import request from 'supertest';
import app from '../../../src/app.js';
import * as usersService from '../../../src/services/usersService.js';
import { NotFoundError } from '@elastic-resume-base/synapse';

const MOCK_USER = {
  uid: 'uid123',
  email: 'alice@example.com',
  displayName: 'Alice',
  role: 'user',
  disabled: false,
};

describe('users controller', () => {
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

      const res = await request(app).get('/api/v1/users');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toHaveLength(1);
    });

    it('passes maxResults and pageToken query params to service', async () => {
      (usersService.listUsers as jest.Mock).mockResolvedValue({ users: [], pageToken: undefined });

      await request(app).get('/api/v1/users?maxResults=10&pageToken=tok123');

      expect(usersService.listUsers).toHaveBeenCalledWith(10, 'tok123');
    });

    it('returns 400 when maxResults is invalid', async () => {
      const res = await request(app).get('/api/v1/users?maxResults=0');
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/v1/users ─────────────────────────────────────────────────────

  describe('POST /api/v1/users', () => {
    it('returns 201 with the created user', async () => {
      (usersService.createUser as jest.Mock).mockResolvedValue(MOCK_USER);

      const res = await request(app)
        .post('/api/v1/users')
        .send({ email: 'alice@example.com', displayName: 'Alice' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uid).toBe('uid123');
    });

    it('returns 400 when email is missing', async () => {
      const res = await request(app).post('/api/v1/users').send({ displayName: 'Alice' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when email is invalid', async () => {
      const res = await request(app).post('/api/v1/users').send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/v1/users/:uid ─────────────────────────────────────────────────

  describe('GET /api/v1/users/:uid', () => {
    it('returns 200 with the user record', async () => {
      (usersService.getUserByUid as jest.Mock).mockResolvedValue(MOCK_USER);

      const res = await request(app).get('/api/v1/users/uid123');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uid).toBe('uid123');
    });

    it('returns 404 when user is not found', async () => {
      (usersService.getUserByUid as jest.Mock).mockRejectedValue(
        new NotFoundError('User not found'),
      );

      const res = await request(app).get('/api/v1/users/missing-uid');
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/v1/users/:uid ───────────────────────────────────────────────

  describe('PATCH /api/v1/users/:uid', () => {
    it('returns 200 with the updated user', async () => {
      const updated = { ...MOCK_USER, displayName: 'Alice Updated' };
      (usersService.updateUser as jest.Mock).mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/v1/users/uid123')
        .send({ displayName: 'Alice Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.displayName).toBe('Alice Updated');
    });

    it('returns 400 when payload is invalid', async () => {
      const res = await request(app)
        .patch('/api/v1/users/uid123')
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when user does not exist', async () => {
      (usersService.updateUser as jest.Mock).mockRejectedValue(
        new NotFoundError('User not found'),
      );

      const res = await request(app)
        .patch('/api/v1/users/missing-uid')
        .send({ displayName: 'Name' });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/v1/users/:uid ──────────────────────────────────────────────

  describe('DELETE /api/v1/users/:uid', () => {
    it('returns 204 on successful deletion', async () => {
      (usersService.deleteUser as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app).delete('/api/v1/users/uid123');
      expect(res.status).toBe(204);
    });

    it('returns 404 when user does not exist', async () => {
      (usersService.deleteUser as jest.Mock).mockRejectedValue(
        new NotFoundError('User not found'),
      );

      const res = await request(app).delete('/api/v1/users/missing-uid');
      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/v1/users/:uid/role ────────────────────────────────────────────

  describe('GET /api/v1/users/:uid/role', () => {
    it('returns 200 with role when user has access', async () => {
      (usersService.getUserRole as jest.Mock).mockResolvedValue('admin');

      const res = await request(app).get('/api/v1/users/uid123/role');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('admin');
    });

    it('returns 403 when user has no access (getUserRole returns null)', async () => {
      (usersService.getUserRole as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/users/uid-no-access/role');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ── POST /api/v1/users/roles/batch ────────────────────────────────────────

  describe('POST /api/v1/users/roles/batch', () => {
    it('returns the roles map', async () => {
      (usersService.getUserRolesBatch as jest.Mock).mockResolvedValue({
        uid1: 'admin',
        uid2: 'user',
      });

      const res = await request(app)
        .post('/api/v1/users/roles/batch')
        .send({ uids: ['uid1', 'uid2'] });

      expect(res.status).toBe(200);
      expect(res.body['uid1']).toBe('admin');
      expect(res.body['uid2']).toBe('user');
    });

    it('returns 400 when uids is missing', async () => {
      const res = await request(app).post('/api/v1/users/roles/batch').send({});
      expect(res.status).toBe(400);
    });
  });
});
