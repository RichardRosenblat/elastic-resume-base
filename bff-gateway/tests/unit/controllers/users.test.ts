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

import * as admin from 'firebase-admin';
import * as usersService from '../../../src/services/usersService.js';
import { NotFoundError } from '../../../src/errors.js';

const mockUser = {
  uid: 'uid123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: undefined,
  disabled: false,
  emailVerified: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  lastLoginAt: '2024-01-02T00:00:00.000Z',
};

function setupAuth() {
  (admin.auth as jest.Mock).mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'admin-uid', email: 'admin@example.com' }),
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
      expect(res.body).toMatchObject({ uid: 'uid123', email: 'test@example.com' });
    });

    it('returns 400 on invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('returns 400 on short password', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', 'Bearer valid-token')
        .send({ email: 'test@example.com', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/users/:uid', () => {
    it('returns 200 on success', async () => {
      (usersService.getUserByUid as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/v1/users/uid123')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ uid: 'uid123' });
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
      expect(res.body.displayName).toBe('Updated Name');
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
      expect(res.body.users).toHaveLength(1);
      expect(res.body.users[0]).toMatchObject({ uid: 'uid123' });
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });
  });
});
