/**
 * Unit tests for bff-gateway search controller.
 * Tests searchHandler via Fastify app injection.
 */

jest.mock('../../../src/services/searchClient', () => ({
  search: jest.fn(),
}));

jest.mock('../../../src/services/userApiClient', () => ({
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

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { _setTokenVerifier, _resetTokenVerifier } from '../../../src/middleware/auth.js';
import * as searchClient from '../../../src/services/searchClient.js';
import { UnavailableError, DownstreamError } from '../../../src/errors.js';

const mockVerifier = { verifyToken: jest.fn() };

function setupAuth(uid = 'user-uid') {
  mockVerifier.verifyToken.mockResolvedValue({ uid, email: `${uid}@example.com` });
}

describe('Search Controller', () => {
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
    (searchClient.search as jest.Mock).mockResolvedValue({
      results: [{ id: '1', score: 0.9 }],
    });
  });

  describe('POST /api/v1/search', () => {
    it('returns 200 with search results on success', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: { authorization: 'Bearer valid-token' },
        payload: { query: 'software engineer' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ results: [{ id: '1', score: 0.9 }] });
    });

    it('passes optional filters, limit, and offset to searchClient', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          query: 'developer',
          filters: { role: 'engineer' },
          limit: 10,
          offset: 5,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(searchClient.search).toHaveBeenCalledWith({
        query: 'developer',
        filters: { role: 'engineer' },
        limit: 10,
        offset: 5,
      });
    });

    it('returns 400 when query is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: { authorization: 'Bearer valid-token' },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when query is empty string', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: { authorization: 'Bearer valid-token' },
        payload: { query: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when query exceeds 1000 characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: { authorization: 'Bearer valid-token' },
        payload: { query: 'a'.repeat(1001) },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when limit is out of range', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: { authorization: 'Bearer valid-token' },
        payload: { query: 'test', limit: 200 },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        payload: { query: 'test' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 503 when search service is unavailable', async () => {
      (searchClient.search as jest.Mock).mockRejectedValue(
        new UnavailableError('Search service unavailable'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: { authorization: 'Bearer valid-token' },
        payload: { query: 'test' },
      });

      expect(res.statusCode).toBe(503);
    });

    it('returns 502 on DownstreamError', async () => {
      (searchClient.search as jest.Mock).mockRejectedValue(
        new DownstreamError('Search service error'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/search',
        headers: { authorization: 'Bearer valid-token' },
        payload: { query: 'test' },
      });

      expect(res.statusCode).toBe(502);
    });
  });
});
