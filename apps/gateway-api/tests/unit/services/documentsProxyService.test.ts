/**
 * Unit tests for documentsProxyService.
 *
 * The HTTP client (axios) is stubbed via the createHttpClient factory mock so
 * that all network calls can be controlled in-process without a running server.
 */

jest.mock('../../../src/config', () => ({
  config: {
    documentReaderServiceUrl: 'http://document-reader.test',
    requestTimeoutMs: 5000,
    nodeEnv: 'test',
    gcpProjectId: 'demo-project',
    port: 3000,
    logLevel: 'silent',
    projectId: 'demo',
    allowedOrigins: 'http://localhost:3000',
    ingestorServiceUrl: 'http://localhost:8001',
    searchBaseServiceUrl: 'http://localhost:8002',
    fileGeneratorServiceUrl: 'http://localhost:8003',
    userApiServiceUrl: 'http://localhost:8005',
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Stub the HTTP client so we can simulate any response without a real network.
const mockRequest = jest.fn();

jest.mock('../../../src/utils/httpClient', () => ({
  createHttpClient: () => ({
    request: mockRequest,
  }),
}));

import { AxiosError, type AxiosResponse } from 'axios';
import {
  proxyToDocumentReaderApi,
  MAX_PROXY_BODY_SIZE_BYTES,
  MAX_QUERY_STRING_LENGTH,
} from '../../../src/services/documentsProxyService.js';
import {
  DownstreamError,
  UnavailableError,
  ValidationError,
} from '../../../src/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal successful axios-like response. */
function makeAxiosResponse(
  status: number,
  data: unknown = {},
  headers: Record<string, string> = {},
) {
  return { status, data, headers };
}

/** Creates a minimal axios network-level error (no response). */
function makeAxiosNetworkError(code: string): AxiosError {
  const err = new AxiosError('Network error', code);
  return err;
}

/** Creates a minimal axios HTTP error (has a response with a status code). */
function makeAxiosHttpError(status: number): AxiosError {
  const err = new AxiosError('HTTP error', 'ERR_BAD_RESPONSE');
  (err as AxiosError).response = { status } as AxiosResponse;
  return err;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Successful proxy calls
// ---------------------------------------------------------------------------

describe('proxyToDocumentReaderApi — successful responses', () => {
  it('forwards a GET request and returns the parsed response', async () => {
    const responseBody = { success: true, data: { status: 'ok' } };
    mockRequest.mockResolvedValue(makeAxiosResponse(200, responseBody));

    const result = await proxyToDocumentReaderApi(
      'GET',
      '/api/v1/documents/status',
      {},
      null,
      'corr-1',
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual(responseBody);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: '/api/v1/documents/status' }),
    );
  });

  it('passes query string in the URL to the upstream service', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(200, { success: true, data: [] }));

    const result = await proxyToDocumentReaderApi(
      'GET',
      '/api/v1/documents/status?format=json',
      {},
      null,
      'corr-qs',
    );

    expect(result.statusCode).toBe(200);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/v1/documents/status?format=json' }),
    );
  });

  it('forwards a POST request and includes the body', async () => {
    const requestBody = { fileReference: 'doc-1', options: { extractTables: true } };
    mockRequest.mockResolvedValue(makeAxiosResponse(201, { success: true, data: requestBody }));

    const result = await proxyToDocumentReaderApi(
      'POST',
      '/api/v1/documents/batch',
      { 'content-type': 'application/json' },
      requestBody,
      'corr-2',
    );

    expect(result.statusCode).toBe(201);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', data: requestBody }),
    );
  });

  it('forwards a DELETE request with no body (data is undefined)', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(204, null));

    await proxyToDocumentReaderApi(
      'DELETE',
      '/api/v1/documents/doc-id',
      {},
      null,
      'corr-4',
    );

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELETE', data: undefined }),
    );
  });

  it('passes through 4xx responses unchanged', async () => {
    const errorBody = { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } };
    mockRequest.mockResolvedValue(makeAxiosResponse(404, errorBody));

    const result = await proxyToDocumentReaderApi(
      'GET',
      '/api/v1/documents/missing',
      {},
      null,
      'corr-5',
    );

    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual(errorBody);
  });

  it('uses validateStatus: () => true so axios does not throw for non-2xx', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(400, { error: 'bad' }));

    const result = await proxyToDocumentReaderApi(
      'GET',
      '/api/v1/documents/x',
      {},
      null,
      'corr-vs',
    );

    expect(result.statusCode).toBe(400);
    const callArg = mockRequest.mock.calls[0][0] as { validateStatus?: (s: number) => boolean };
    expect(callArg.validateStatus).toBeDefined();
    expect(callArg.validateStatus!(400)).toBe(true);
    expect(callArg.validateStatus!(500)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Header filtering
// ---------------------------------------------------------------------------

describe('proxyToDocumentReaderApi — header filtering', () => {
  it('does not forward the authorization header to the upstream service', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(200, {}));

    await proxyToDocumentReaderApi(
      'GET',
      '/api/v1/documents/status',
      { authorization: 'Bearer secret-token' },
      null,
      'corr-hdr',
    );

    const sentHeaders = (mockRequest.mock.calls[0][0] as { headers: Record<string, unknown> }).headers;
    expect(sentHeaders['authorization']).toBeUndefined();
  });

  it('does not forward the host header', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(200, {}));

    await proxyToDocumentReaderApi(
      'GET',
      '/api/v1/documents/status',
      { host: 'public.example.com' },
      null,
      'corr-hdr2',
    );

    const sentHeaders = (mockRequest.mock.calls[0][0] as { headers: Record<string, unknown> }).headers;
    expect(sentHeaders['host']).toBeUndefined();
  });

  it('does not forward connection or transfer-encoding headers', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(200, {}));

    await proxyToDocumentReaderApi(
      'GET',
      '/api/v1/documents/status',
      { connection: 'keep-alive', 'transfer-encoding': 'chunked' },
      null,
      'corr-conn',
    );

    const sentHeaders = (mockRequest.mock.calls[0][0] as { headers: Record<string, unknown> }).headers;
    expect(sentHeaders['connection']).toBeUndefined();
    expect(sentHeaders['transfer-encoding']).toBeUndefined();
  });

  it('forwards safe headers such as content-type and custom x-* headers', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(200, {}));

    await proxyToDocumentReaderApi(
      'POST',
      '/api/v1/documents/batch',
      {
        'content-type': 'application/json',
        'x-correlation-id': 'corr-safe',
      },
      { fileReference: 'doc-1' },
      'corr-safe',
    );

    const sentHeaders = (mockRequest.mock.calls[0][0] as { headers: Record<string, unknown> }).headers;
    expect(sentHeaders['content-type']).toBe('application/json');
    expect(sentHeaders['x-correlation-id']).toBe('corr-safe');
  });

  it('strips connection-level headers from the response', async () => {
    mockRequest.mockResolvedValue(
      makeAxiosResponse(200, {}, {
        connection: 'keep-alive',
        'transfer-encoding': 'chunked',
        'content-type': 'application/json',
      }),
    );

    const result = await proxyToDocumentReaderApi(
      'GET',
      '/api/v1/documents/status',
      {},
      null,
      'corr-resp-hdr',
    );

    expect(result.headers['connection']).toBeUndefined();
    expect(result.headers['transfer-encoding']).toBeUndefined();
    expect(result.headers['content-type']).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

describe('proxyToDocumentReaderApi — error mapping', () => {
  it('throws DownstreamError (502) when Document Reader returns 500', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(500, { error: 'internal' }));

    await expect(
      proxyToDocumentReaderApi('GET', '/api/v1/documents/status', {}, null, 'corr-500'),
    ).rejects.toBeInstanceOf(DownstreamError);

    await expect(
      proxyToDocumentReaderApi('GET', '/api/v1/documents/status', {}, null, 'corr-500b'),
    ).rejects.toMatchObject({ code: 'DOWNSTREAM_ERROR', statusCode: 502 });
  });

  it('throws DownstreamError (502) when Document Reader returns 503', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(503, {}));

    await expect(
      proxyToDocumentReaderApi('GET', '/api/v1/documents/status', {}, null, 'corr-503'),
    ).rejects.toMatchObject({ code: 'DOWNSTREAM_ERROR', statusCode: 502 });
  });

  it('throws DownstreamError (504) when the connection times out (ECONNABORTED)', async () => {
    mockRequest.mockRejectedValue(makeAxiosNetworkError('ECONNABORTED'));

    await expect(
      proxyToDocumentReaderApi('GET', '/api/v1/documents/status', {}, null, 'corr-timeout'),
    ).rejects.toMatchObject({ code: 'GATEWAY_TIMEOUT', statusCode: 504 });
  });

  it('throws DownstreamError (504) when the connection times out (ETIMEDOUT)', async () => {
    mockRequest.mockRejectedValue(makeAxiosNetworkError('ETIMEDOUT'));

    await expect(
      proxyToDocumentReaderApi('GET', '/api/v1/documents/status', {}, null, 'corr-etimedout'),
    ).rejects.toMatchObject({ code: 'GATEWAY_TIMEOUT', statusCode: 504 });
  });

  it('throws UnavailableError (503) when connection is refused (ECONNREFUSED)', async () => {
    mockRequest.mockRejectedValue(makeAxiosNetworkError('ECONNREFUSED'));

    await expect(
      proxyToDocumentReaderApi('GET', '/api/v1/documents/status', {}, null, 'corr-refused'),
    ).rejects.toBeInstanceOf(UnavailableError);
  });

  it('throws UnavailableError (503) when the host is not found (ENOTFOUND)', async () => {
    mockRequest.mockRejectedValue(makeAxiosNetworkError('ENOTFOUND'));

    await expect(
      proxyToDocumentReaderApi('GET', '/api/v1/documents/status', {}, null, 'corr-notfound'),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', statusCode: 503 });
  });

  it('throws DownstreamError for unexpected Axios HTTP errors with a response', async () => {
    mockRequest.mockRejectedValue(makeAxiosHttpError(422));

    await expect(
      proxyToDocumentReaderApi('GET', '/api/v1/documents/status', {}, null, 'corr-422'),
    ).rejects.toBeInstanceOf(DownstreamError);
  });

  it('re-throws non-Axios errors (e.g. programming errors) unchanged', async () => {
    mockRequest.mockRejectedValue(new TypeError('Unexpected type'));

    await expect(
      proxyToDocumentReaderApi('GET', '/api/v1/documents/status', {}, null, 'corr-type'),
    ).rejects.toBeInstanceOf(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('proxyToDocumentReaderApi — input validation', () => {
  it('throws ValidationError when Content-Length exceeds the maximum', async () => {
    await expect(
      proxyToDocumentReaderApi(
        'POST',
        '/api/v1/documents/batch',
        { 'content-length': String(MAX_PROXY_BODY_SIZE_BYTES + 1) },
        { fileReference: 'doc-1' },
        'corr-size',
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('does not throw when Content-Length equals exactly the maximum', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(201, {}));

    await expect(
      proxyToDocumentReaderApi(
        'POST',
        '/api/v1/documents/batch',
        { 'content-length': String(MAX_PROXY_BODY_SIZE_BYTES) },
        { fileReference: 'doc-1' },
        'corr-exact',
      ),
    ).resolves.toMatchObject({ statusCode: 201 });
  });

  it('throws ValidationError when query string exceeds the maximum length', async () => {
    const longQuery = 'q='.padEnd(MAX_QUERY_STRING_LENGTH + 2, 'b');

    await expect(
      proxyToDocumentReaderApi('GET', `/api/v1/documents/status?${longQuery}`, {}, null, 'corr-qs-long'),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('does not throw for query strings within the maximum length', async () => {
    mockRequest.mockResolvedValue(makeAxiosResponse(200, {}));
    const acceptableQuery = 'q='.padEnd(MAX_QUERY_STRING_LENGTH - 1, 'x');

    await expect(
      proxyToDocumentReaderApi(
        'GET',
        `/api/v1/documents/status?${acceptableQuery}`,
        {},
        null,
        'corr-qs-ok',
      ),
    ).resolves.toMatchObject({ statusCode: 200 });
  });

  it('does not call the HTTP client when Content-Length is invalid', async () => {
    await expect(
      proxyToDocumentReaderApi(
        'POST',
        '/api/v1/documents/bulk',
        { 'content-length': '999999999' },
        {},
        'corr-cl',
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(mockRequest).not.toHaveBeenCalled();
  });
});
