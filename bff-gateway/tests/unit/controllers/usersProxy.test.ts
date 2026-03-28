/**
 * Unit tests for the usersProxy controller handler.
 *
 * Tests verify:
 * - Transparent forwarding for routes not matched by explicit BFF routes.
 * - Error propagation (errors thrown by proxyToUsersApi bubble up to the
 *   Fastify error handler).
 * - Authentication is required (handled by the parent authHook).
 *
 * NOTE: Explicit BFF routes (e.g. GET /:uid, DELETE /:uid) take priority over
 * the catch-all wildcard.  To exercise the proxy, the tests use multi-segment
 * paths (e.g. /stats/overview) that do NOT match any parameterised BFF route.
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { _setTokenVerifier, _resetTokenVerifier } from '../../../src/middleware/auth.js';
import { DownstreamError, UnavailableError, ValidationError } from '../../../src/errors.js';

jest.mock('../../../src/services/userApiClient', () => ({
  authorizeUser: jest.fn().mockResolvedValue({ role: 'admin', enable: true }),
}));

jest.mock('../../../src/services/usersProxyService', () => ({
  proxyToUsersApi: jest.fn(),
  MAX_PROXY_BODY_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_QUERY_STRING_LENGTH: 4096,
}));

import * as usersProxyService from '../../../src/services/usersProxyService.js';

const mockVerifier = { verifyToken: jest.fn() };

function setupAuth(uid = 'admin-uid') {
  mockVerifier.verifyToken.mockResolvedValue({ uid, email: `${uid}@example.com` });
}

describe('usersProxy controller — transparent proxy', () => {
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

  describe('unmatched routes are proxied transparently', () => {
    // Use multi-segment paths (e.g. /stats/overview) so they do not match
    // the existing BFF parameterised routes (which only match one segment).

    it('proxies GET request for an unknown multi-segment Users API endpoint', async () => {
      const responseBody = { success: true, data: { stat: 42 } };
      (usersProxyService.proxyToUsersApi as jest.Mock).mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: responseBody,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/stats/overview',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(responseBody);
      expect(usersProxyService.proxyToUsersApi).toHaveBeenCalledWith(
        'GET',
        '/api/v1/users/stats/overview',
        expect.any(Object),
        // GET requests have no body (undefined)
        undefined,
        expect.any(String),
      );
    });

    it('proxies PUT request (no explicit BFF PUT route exists)', async () => {
      const requestPayload = { data: 'custom' };
      const responseBody = { success: true, data: { created: true } };
      (usersProxyService.proxyToUsersApi as jest.Mock).mockResolvedValue({
        statusCode: 201,
        headers: {},
        body: responseBody,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/users/uid123',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        payload: requestPayload,
      });

      expect(res.statusCode).toBe(201);
      expect(usersProxyService.proxyToUsersApi).toHaveBeenCalledWith(
        'PUT',
        '/api/v1/users/uid123',
        expect.any(Object),
        requestPayload,
        expect.any(String),
      );
    });

    it('proxies DELETE request for a nested path and forwards 204 No Content', async () => {
      (usersProxyService.proxyToUsersApi as jest.Mock).mockResolvedValue({
        statusCode: 204,
        headers: {},
        body: null,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/users/uid1/relationships/uid2',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(204);
    });

    it('passes through 4xx responses from the Users API without transformation', async () => {
      const errorBody = { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } };
      (usersProxyService.proxyToUsersApi as jest.Mock).mockResolvedValue({
        statusCode: 404,
        headers: { 'content-type': 'application/json' },
        body: errorBody,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/nested/missing-resource',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual(errorBody);
    });

    it('forwards response headers from the upstream to the client', async () => {
      (usersProxyService.proxyToUsersApi as jest.Mock).mockResolvedValue({
        statusCode: 200,
        headers: { 'x-custom-header': 'proxy-value', 'content-type': 'application/json' },
        body: { ok: true },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/nested/resource',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-custom-header']).toBe('proxy-value');
    });
  });

  describe('error propagation', () => {
    it('returns 502 when proxyToUsersApi throws DownstreamError', async () => {
      (usersProxyService.proxyToUsersApi as jest.Mock).mockRejectedValue(
        new DownstreamError('Users API returned a server error'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/new/endpoint',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(502);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DOWNSTREAM_ERROR');
    });

    it('returns 503 when proxyToUsersApi throws UnavailableError', async () => {
      (usersProxyService.proxyToUsersApi as jest.Mock).mockRejectedValue(
        new UnavailableError('Users API is unavailable'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/new/endpoint',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(503);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('returns 504 when proxyToUsersApi throws DownstreamError with 504 status (timeout)', async () => {
      (usersProxyService.proxyToUsersApi as jest.Mock).mockRejectedValue(
        new DownstreamError('Users API request timed out', 504, 'GATEWAY_TIMEOUT'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/slow/endpoint',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(504);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('GATEWAY_TIMEOUT');
    });

    it('returns 400 when proxyToUsersApi throws ValidationError', async () => {
      (usersProxyService.proxyToUsersApi as jest.Mock).mockRejectedValue(
        new ValidationError('Request body too large'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users/bulk/import',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        payload: { data: 'test' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('authentication guard', () => {
    it('returns 401 when no authorization header is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users/nested/endpoint',
      });

      expect(res.statusCode).toBe(401);
      expect(usersProxyService.proxyToUsersApi).not.toHaveBeenCalled();
    });
  });

  describe('explicit routes take priority over the catch-all proxy', () => {
    it('GET /api/v1/users (explicit listUsers route) does not invoke the proxy handler', async () => {
      // The explicit GET '/' route is handled by listUsersHandler, not the proxy.
      // We verify the proxy was NOT called regardless of the listUsers outcome.
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: 'Bearer valid-token' },
      });

      // The proxy must not have been invoked.
      expect(usersProxyService.proxyToUsersApi).not.toHaveBeenCalled();
      // The explicit route ran — status may vary (200 or 500) based on mock state.
      expect(res.statusCode).not.toBe(0);
    });
  });
});

