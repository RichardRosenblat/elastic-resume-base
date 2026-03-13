import { Request, Response, NextFunction } from 'express';
import { authMiddleware, _resetFirebaseApp } from '../../../src/middleware/auth.js';

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({}),
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn(),
  }),
}));

import * as admin from 'firebase-admin';

describe('authMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
    // Reset apps array
    (admin.apps as unknown[]).length = 0;
    _resetFirebaseApp();
  });

  it('returns 401 when no Authorization header', async () => {
    await authMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    req.headers = { authorization: 'Basic sometoken' };
    await authMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token verification fails', async () => {
    req.headers = { authorization: 'Bearer invalid-token' };
    const mockVerifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));
    (admin.auth as jest.Mock).mockReturnValue({ verifyIdToken: mockVerifyIdToken });
    await authMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.user when token is valid', async () => {
    req.headers = { authorization: 'Bearer valid-token' };
    const decodedToken = { uid: 'user123', email: 'test@example.com', name: 'Test User', picture: 'http://pic.url' };
    const mockVerifyIdToken = jest.fn().mockResolvedValue(decodedToken);
    (admin.auth as jest.Mock).mockReturnValue({ verifyIdToken: mockVerifyIdToken });
    await authMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect((req as Request & { user: unknown }).user).toEqual({
      uid: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'http://pic.url',
    });
  });
});
