/**
 * Unit tests for bff-gateway documents controller.
 * Tests readDocumentHandler and ocrDocumentsHandler via Fastify app injection.
 */

jest.mock('../../../src/services/documentReaderClient', () => ({
  readDocument: jest.fn(),
  ocrDocuments: jest.fn(),
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
import * as documentReaderClient from '../../../src/services/documentReaderClient.js';
import { UnavailableError, DownstreamError } from '../../../src/errors.js';

const mockVerifier = { verifyToken: jest.fn() };

function setupAuth(uid = 'user-uid') {
  mockVerifier.verifyToken.mockResolvedValue({ uid, email: `${uid}@example.com` });
}

describe('Documents Controller', () => {
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
    (documentReaderClient.readDocument as jest.Mock).mockResolvedValue({
      text: 'extracted text',
    });
    (documentReaderClient.ocrDocuments as jest.Mock).mockResolvedValue({
      headers: { 'content-disposition': 'attachment; filename=out.xlsx' },
      data: Buffer.from('excel-binary'),
    });
  });

  // ── POST /api/v1/documents/read ────────────────────────────────────────────

  describe('POST /api/v1/documents/read', () => {
    it('returns 200 with extracted text on success', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/read',
        headers: { authorization: 'Bearer valid-token' },
        payload: { fileReference: 'file-1' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ text: 'extracted text' });
    });

    it('returns 200 with options', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/read',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          fileReference: 'file-2',
          options: { extractTables: true, language: 'en' },
        },
      });

      expect(res.statusCode).toBe(200);
      expect(documentReaderClient.readDocument).toHaveBeenCalledWith({
        fileReference: 'file-2',
        options: { extractTables: true, language: 'en' },
      });
    });

    it('returns 400 when fileReference is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/read',
        headers: { authorization: 'Bearer valid-token' },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when fileReference is empty string', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/read',
        headers: { authorization: 'Bearer valid-token' },
        payload: { fileReference: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/read',
        payload: { fileReference: 'file-1' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 503 when document reader is unavailable', async () => {
      (documentReaderClient.readDocument as jest.Mock).mockRejectedValue(
        new UnavailableError('DocumentReader service unavailable'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/read',
        headers: { authorization: 'Bearer valid-token' },
        payload: { fileReference: 'file-1' },
      });

      expect(res.statusCode).toBe(503);
    });

    it('returns 502 on DownstreamError', async () => {
      (documentReaderClient.readDocument as jest.Mock).mockRejectedValue(
        new DownstreamError('DocumentReader service error'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/read',
        headers: { authorization: 'Bearer valid-token' },
        payload: { fileReference: 'file-1' },
      });

      expect(res.statusCode).toBe(502);
    });
  });

  // ── POST /api/v1/documents/ocr ────────────────────────────────────────────

  describe('POST /api/v1/documents/ocr', () => {
    it('returns 200 with Excel binary on success', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/ocr',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'multipart/form-data; boundary=abc123',
        },
        payload: Buffer.from('fake-multipart-data'),
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toBe('attachment; filename=out.xlsx');
    });

    it('uses default content-disposition when upstream omits it', async () => {
      (documentReaderClient.ocrDocuments as jest.Mock).mockResolvedValue({
        headers: {},
        data: Buffer.from('excel'),
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/ocr',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'multipart/form-data; boundary=abc',
        },
        payload: Buffer.from('data'),
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename=extracted_documents.xlsx',
      );
    });

    it('returns 400 when content-type is not multipart/form-data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/ocr',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        payload: { data: 'test' },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('returns 400 when content-type header is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/ocr',
        headers: {
          authorization: 'Bearer valid-token',
        },
        payload: Buffer.from('data'),
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/ocr',
        headers: {
          'content-type': 'multipart/form-data; boundary=abc',
        },
        payload: Buffer.from('data'),
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 503 when document reader is unavailable', async () => {
      (documentReaderClient.ocrDocuments as jest.Mock).mockRejectedValue(
        new UnavailableError('service down'),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents/ocr',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'multipart/form-data; boundary=abc',
        },
        payload: Buffer.from('data'),
      });

      expect(res.statusCode).toBe(503);
    });
  });
});
