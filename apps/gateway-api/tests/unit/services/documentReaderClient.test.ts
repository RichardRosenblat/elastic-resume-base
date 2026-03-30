/**
 * Unit tests for gateway-api documentReaderClient — covers readDocument and ocrDocuments,
 * including success paths and all error branches.
 */

jest.mock('../../../src/config', () => ({
  config: {
    documentReaderServiceUrl: 'http://localhost:8004',
    requestTimeoutMs: 30000,
    nodeEnv: 'test',
    gcpProjectId: 'demo-project',
  },
}));

const mockPost = jest.fn();

jest.mock('../../../src/utils/httpClient', () => ({
  createHttpClient: () => ({
    post: mockPost,
  }),
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

import { DownstreamError, RateLimitError, UnavailableError } from '../../../src/errors.js';
import { readDocument, ocrDocuments } from '../../../src/services/documentReaderClient.js';

/** Builds a minimal AxiosError-like object */
function makeAxiosError(opts: {
  code?: string;
  status?: number;
  data?: unknown;
  response?: boolean;
}): Error {
  const err = new Error('axios error') as Error & {
    isAxiosError: boolean;
    code?: string;
    response?: { status: number; data: unknown } | null;
  };
  err.isAxiosError = true;
  err.code = opts.code;
  if (opts.response === false) {
    err.response = null;
  } else if (opts.status !== undefined) {
    err.response = { status: opts.status, data: opts.data ?? {} };
  }
  return err;
}

describe('documentReaderClient – readDocument', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns DocumentReadResponse on success', async () => {
    const fakeResponse = { text: 'hello', metadata: {} };
    mockPost.mockResolvedValue({ data: fakeResponse });

    const result = await readDocument({ fileReference: 'file-1' });
    expect(result).toEqual(fakeResponse);
    expect(mockPost).toHaveBeenCalledWith('/read', { fileReference: 'file-1' });
  });

  it('throws UnavailableError on ECONNABORTED', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ECONNABORTED' }));
    await expect(readDocument({ fileReference: 'f' })).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError on ETIMEDOUT', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ETIMEDOUT' }));
    await expect(readDocument({ fileReference: 'f' })).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError when no response', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ response: false }));
    await expect(readDocument({ fileReference: 'f' })).rejects.toThrow(UnavailableError);
  });

  it('throws RateLimitError on 429', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 429 }));
    await expect(readDocument({ fileReference: 'f' })).rejects.toThrow(RateLimitError);
  });

  it('throws UnavailableError on 500', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 500 }));
    await expect(readDocument({ fileReference: 'f' })).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError on 503', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 503 }));
    await expect(readDocument({ fileReference: 'f' })).rejects.toThrow(UnavailableError);
  });

  it('throws DownstreamError on 4xx (non-429)', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 400 }));
    await expect(readDocument({ fileReference: 'f' })).rejects.toThrow(DownstreamError);
  });

  it('throws DownstreamError on non-axios error', async () => {
    mockPost.mockRejectedValue(new Error('network failure'));
    await expect(readDocument({ fileReference: 'f' })).rejects.toThrow(DownstreamError);
  });
});

describe('documentReaderClient – ocrDocuments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns headers and data Buffer on success', async () => {
    const fakeBuffer = Buffer.from('excel-binary');
    mockPost.mockResolvedValue({
      headers: { 'content-disposition': 'attachment; filename=out.xlsx' },
      data: fakeBuffer,
    });
    const raw = {} as never;
    const result = await ocrDocuments(raw, 'multipart/form-data; boundary=abc');
    expect(result.data).toBeInstanceOf(Buffer);
    expect(result.headers['content-disposition']).toBe('attachment; filename=out.xlsx');
  });

  it('throws UnavailableError on ECONNABORTED', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ECONNABORTED' }));
    await expect(ocrDocuments({} as never, 'multipart/form-data')).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError on ETIMEDOUT', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ETIMEDOUT' }));
    await expect(ocrDocuments({} as never, 'multipart/form-data')).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError when no response', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ response: false }));
    await expect(ocrDocuments({} as never, 'multipart/form-data')).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError on 500', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 500 }));
    await expect(ocrDocuments({} as never, 'multipart/form-data')).rejects.toThrow(UnavailableError);
  });

  it('throws DownstreamError on 4xx with message body', async () => {
    mockPost.mockRejectedValue(
      makeAxiosError({ status: 422, data: { error: { message: 'File too large' } } }),
    );
    await expect(ocrDocuments({} as never, 'multipart/form-data')).rejects.toThrow(DownstreamError);
  });

  it('throws DownstreamError on 4xx without message body', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 400, data: {} }));
    await expect(ocrDocuments({} as never, 'multipart/form-data')).rejects.toThrow(DownstreamError);
  });

  it('throws DownstreamError on non-axios error', async () => {
    mockPost.mockRejectedValue(new Error('unexpected'));
    await expect(ocrDocuments({} as never, 'multipart/form-data')).rejects.toThrow(DownstreamError);
  });
});
