import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { _setTokenVerifier, _resetTokenVerifier } from '../../src/middleware/auth.js';

jest.mock('../../src/services/usersService', () => ({
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

jest.mock('../../src/services/userApiClient', () => ({
  authorizeUser: jest.fn().mockResolvedValue({ role: 'user', enable: true }),
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

describe('CORS and OPTIONS preflight', () => {
  let app: FastifyInstance;
  const allowedOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    process.env['ALLOWED_ORIGINS'] = allowedOrigin;
    _setTokenVerifier({ verifyToken: jest.fn() });
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    _resetTokenVerifier();
  });

  it('OPTIONS preflight on /health/live responds with 204 and CORS headers', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health/live',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': 'GET',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    const methods = (res.headers['access-control-allow-methods'] as string)
      .split(',')
      .map(m => m.trim());
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('OPTIONS');
  });

  it('OPTIONS preflight on /api/v1/users/me responds with 204 without requiring auth', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/users/me',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'Authorization',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('CORS response headers are set for allowed origin on normal requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { origin: allowedOrigin },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('exposes x-correlation-id response header to cross-origin clients', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: {
        origin: allowedOrigin,
        'x-correlation-id': 'test-id-123',
      },
    });

    expect(res.statusCode).toBe(200);
    const exposed = (res.headers['access-control-expose-headers'] as string | undefined) ?? '';
    expect(exposed.toLowerCase()).toContain('x-correlation-id');
  });

  it('does not set CORS headers for disallowed origins', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { origin: 'http://evil.example.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allowedHeaders includes Authorization for cross-origin requests with credentials', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health/live',
      headers: {
        origin: allowedOrigin,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'Authorization',
      },
    });

    expect(res.statusCode).toBe(204);
    const allowed = (res.headers['access-control-allow-headers'] as string | undefined) ?? '';
    expect(allowed.toLowerCase()).toContain('authorization');
  });
});
