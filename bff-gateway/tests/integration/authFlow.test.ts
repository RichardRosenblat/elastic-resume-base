import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { _setTokenVerifier, _resetTokenVerifier } from '../../src/middleware/auth.js';

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

const mockVerifier = { verifyToken: jest.fn() };

describe('Auth Flow Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    _setTokenVerifier(mockVerifier);
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    _resetTokenVerifier();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/me with valid mocked token returns user profile', async () => {
    const mockDecodedToken = {
      uid: 'integration-user-001',
      email: 'integration@example.com',
      name: 'Integration User',
      picture: 'https://example.com/photo.jpg',
    };

    mockVerifier.verifyToken.mockResolvedValue(mockDecodedToken);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: {
        authorization: 'Bearer mock-firebase-token',
        'x-correlation-id': 'test-correlation-id',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      uid: 'integration-user-001',
      email: 'integration@example.com',
      name: 'Integration User',
    });
    expect(res.headers['x-correlation-id']).toBe('test-correlation-id');
  });
});
