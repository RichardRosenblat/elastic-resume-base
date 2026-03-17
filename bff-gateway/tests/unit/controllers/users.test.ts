import request from 'supertest';
import app from '../../../src/app.js';
import { _resetFirebaseApp } from '../../../src/middleware/auth.js';

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({}),
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn(),
    createUser: jest.fn(),
    getUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    listUsers: jest.fn(),
  }),
}));

jest.mock('../../../src/services/usersService', () => ({
  createUser: jest.fn(),
  getUserByUid: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  listUsers: jest.fn(),
}));

// Prevent real HTTP calls to UserAPI from within app initialization
jest.mock('../../../src/services/userApiClient', () => ({
  getUserRole: jest.fn().mockResolvedValue('user'),
  getUserRolesBatch: jest.fn().mockResolvedValue({}),
}));

import * as admin from 'firebase-admin';
import * as usersService from '../../../src/services/usersService.js';
import { ForbiddenError, NotFoundError } from '../../../src/errors.js';

const mockUser = {
  uid: 'uid123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: undefined,
  disabled: false,
  emailVerified: false,
  role: 'user',
  createdAt: '2024-01-01T00:00:00.000Z',
  lastLoginAt: '2024-01-02T00:00:00.000Z',
};

function setupAuth(uid = 'admin-uid') {
  (admin.auth as jest.Mock).mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid, email: `${uid}@example.com` }),
  });
}

describe('Users Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (admin.apps as unknown[]).length = 0;
    _resetFirebaseApp();
    setupAuth();
  });

  describe('POST /api/v1/users', () => {
    it('returns 201 on success', async () => {
      (usersService.createUser as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ uid: 'uid123', email: 'test@example.com' });
    });

    it('returns 400 on invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 on short password', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'test@example.com', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });

    it('returns 403 when service throws ForbiddenError', async () => {
      (usersService.createUser as jest.Mock).mockRejectedValue(new ForbiddenError('Admin access required'));

      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/users/:uid', () => {
    it('returns 200 on success', async () => {
      (usersService.getUserByUid as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/v1/users/uid123')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ uid: 'uid123' });
    });

    it('returns 404 when NotFoundError thrown', async () => {
      (usersService.getUserByUid as jest.Mock).mockRejectedValue(new NotFoundError('User uid123 not found'));

      const res = await request(app)
        .get('/api/v1/users/uid123')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/users/uid123');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/users/:uid', () => {
    it('returns 200 on success', async () => {
      const updated = { ...mockUser, displayName: 'Updated Name' };
      (usersService.updateUser as jest.Mock).mockResolvedValue(updated);

      const res = await request(app)
        .patch('/api/v1/users/uid123')
        .set('Authorization', 'Bearer valid-token')
        .send({ displayName: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBe('Updated Name');
    });

    it('returns 403 when service throws ForbiddenError', async () => {
      (usersService.updateUser as jest.Mock).mockRejectedValue(
        new ForbiddenError('You may only update your own profile'),
      );

      const res = await request(app)
        .patch('/api/v1/users/other-uid')
        .set('Authorization', 'Bearer valid-token')
        .send({ displayName: 'Updated Name' });

      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch('/api/v1/users/uid123')
        .send({ displayName: 'Updated Name' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/users/:uid', () => {
    it('returns 204 on success', async () => {
      (usersService.deleteUser as jest.Mock).mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/v1/users/uid123')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
    });

    it('returns 403 when service throws ForbiddenError', async () => {
      (usersService.deleteUser as jest.Mock).mockRejectedValue(new ForbiddenError('Admin access required'));

      const res = await request(app)
        .delete('/api/v1/users/uid123')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).delete('/api/v1/users/uid123');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/users', () => {
    it('returns 200 with users list', async () => {
      (usersService.listUsers as jest.Mock).mockResolvedValue({ users: [mockUser], pageToken: undefined });

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toHaveLength(1);
      expect(res.body.data.users[0]).toMatchObject({ uid: 'uid123' });
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });
  });
});
