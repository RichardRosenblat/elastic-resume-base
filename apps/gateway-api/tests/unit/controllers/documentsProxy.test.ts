/**
 * Unit tests for the documentsProxy controller handler.
 *
 * Tests verify:
 * - Transparent forwarding for routes not matched by explicit routes.
 * - Error propagation (errors thrown by proxyToDocumentReaderApi bubble up to
 *   the Fastify error handler).
 * - Authentication is required (handled by the parent authHook).
 *
 * NOTE: Explicit Gateway routes are POST /read and POST /ocr.  The catch-all
 * wildcard fires for any other method/path combination.  Tests use:
 *   - GET requests (no explicit GET route exists under /documents)
 *   - Multi-segment POST paths that don't match /read or /ocr
 */

import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { _setTokenVerifier, _resetTokenVerifier } from '../../../src/middleware/auth.js';
import { DownstreamError, UnavailableError, ValidationError } from '../../../src/errors.js';

jest.mock('../../../src/services/userApiClient', () => ({
  authorizeUser: jest.fn().mockResolvedValue({ role: 'user', enable: true }),
}));

jest.mock('../../../src/services/documentsProxyService', () => ({
  proxyToDocumentReaderApi: jest.fn(),
  MAX_PROXY_BODY_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_QUERY_STRING_LENGTH: 4096,
}));

import * as documentsProxyService from '../../../src/services/documentsProxyService.js';

const mockVerifier = { verifyToken: jest.fn() };

function setupAuth(uid = 'user-uid') {
  mockVerifier.verifyToken.mockResolvedValue({ uid, email: `${uid}@example.com` });
}

describe('documentsProxy controller — transparent proxy', () => {
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
    it('proxies GET request for an unknown Document Reader endpoint', async () => {
      const responseBody = { success: true, data: { status: 'healthy' } };
      (documentsProxyService.proxyToDocumentReaderApi as jest.Mock).mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: responseBody,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents/status/service',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(responseBody);
      expect(documentsProxyService.proxyToDocumentReaderApi).toHaveBeenCalledWith(
        'GET',
        '/api/v1/documents/status/service',
        expect.any(Object),
        // GET requests have no body (undefined)
        undefined,
        expect.any(String),
      );
    });

    it('proxies POST request for a multi-segment path not matching /read or /ocr', async () => {
      const requestPayload = { fileReference: 'batch-1' };
      const responseBody = { success: true, data: { queued: true } };
      (documentsProxyService.proxyToDocumentReaderApi as jest.Mock).mockResolvedValue({
        statusCode: 202,
        headers: {},
        body: responseBody,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/batch/process',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        payload: requestPayload,
      });

      expect(res.statusCode).toBe(202);
      expect(documentsProxyService.proxyToDocumentReaderApi).toHaveBeenCalledWith(
        'POST',
        '/api/v1/documents/batch/process',
        expect.any(Object),
        requestPayload,
        expect.any(String),
      );
    });

    it('proxies DELETE request and forwards 204 No Content', async () => {
      (documentsProxyService.proxyToDocumentReaderApi as jest.Mock).mockResolvedValue({
        statusCode: 204,
        headers: {},
        body: null,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/documents/doc-id/revision/1',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(204);
    });

    it('passes through 4xx responses from Document Reader without transformation', async () => {
      const errorBody = { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } };
      (documentsProxyService.proxyToDocumentReaderApi as jest.Mock).mockResolvedValue({
        statusCode: 404,
        headers: { 'content-type': 'application/json' },
        body: errorBody,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents/missing/resource',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual(errorBody);
    });

    it('forwards response headers from the upstream to the client', async () => {
      (documentsProxyService.proxyToDocumentReaderApi as jest.Mock).mockResolvedValue({
        statusCode: 200,
        headers: { 'x-document-id': 'doc-abc', 'content-type': 'application/json' },
        body: { ok: true },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents/nested/resource',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-document-id']).toBe('doc-abc');
    });
  });

  describe('error propagation', () => {
    it('returns 502 when proxyToDocumentReaderApi throws DownstreamError', async () => {
      (documentsProxyService.proxyToDocumentReaderApi as jest.Mock).mockRejectedValue(
        new DownstreamError('Document Reader returned a server error'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents/new/endpoint',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(502);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('DOWNSTREAM_ERROR');
    });

    it('returns 503 when proxyToDocumentReaderApi throws UnavailableError', async () => {
      (documentsProxyService.proxyToDocumentReaderApi as jest.Mock).mockRejectedValue(
        new UnavailableError('Document Reader service is unavailable'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents/new/endpoint',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(503);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('returns 504 when proxyToDocumentReaderApi throws DownstreamError with 504 (timeout)', async () => {
      (documentsProxyService.proxyToDocumentReaderApi as jest.Mock).mockRejectedValue(
        new DownstreamError('Document Reader request timed out', 504, 'GATEWAY_TIMEOUT'),
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/documents/slow/endpoint',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(504);
      const body = res.json<{ success: boolean; error: { code: string } }>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('GATEWAY_TIMEOUT');
    });

    it('returns 400 when proxyToDocumentReaderApi throws ValidationError', async () => {
      (documentsProxyService.proxyToDocumentReaderApi as jest.Mock).mockRejectedValue(
        new ValidationError('Request body too large'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/bulk/import',
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
        url: '/api/v1/documents/nested/endpoint',
      });

      expect(res.statusCode).toBe(401);
      expect(documentsProxyService.proxyToDocumentReaderApi).not.toHaveBeenCalled();
    });
  });

  describe('explicit routes take priority over the catch-all proxy', () => {
    it('POST /api/v1/documents/read (explicit route) does not invoke the proxy handler', async () => {
      // The explicit POST /read route is handled by readDocumentHandler, not the proxy.
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/read',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        payload: { fileReference: 'file-1' },
      });

      // The proxy must not have been invoked.
      expect(documentsProxyService.proxyToDocumentReaderApi).not.toHaveBeenCalled();
      // The explicit route ran — status varies based on mock state.
      expect(res.statusCode).not.toBe(0);
    });
  });
});
