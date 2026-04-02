/**
 * Unit tests for gateway-api downloaderClient — covers triggerIngest,
 * including success paths and all error branches.
 */

jest.mock('../../../src/config', () => ({
  config: {
    ingestorServiceUrl: 'http://localhost:8001',
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
import { triggerIngest } from '../../../src/services/downloaderClient.js';

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

describe('downloaderClient – triggerIngest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns IngestResponse on success', async () => {
    const fakeResponse = { jobId: 'job-1', status: 'accepted' };
    mockPost.mockResolvedValue({ data: fakeResponse });

    const result = await triggerIngest({ sheetId: 'sheet-1' });
    expect(result).toEqual(fakeResponse);
    expect(mockPost).toHaveBeenCalledWith('/ingest', { sheetId: 'sheet-1' });
  });

  it('returns IngestResponse with batchId', async () => {
    const fakeResponse = { jobId: 'job-2', status: 'accepted' };
    mockPost.mockResolvedValue({ data: fakeResponse });

    const result = await triggerIngest({ batchId: 'batch-1' });
    expect(result).toEqual(fakeResponse);
  });

  it('throws UnavailableError on ECONNABORTED', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ECONNABORTED' }));
    await expect(triggerIngest({ sheetId: 's' })).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError on ETIMEDOUT', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ETIMEDOUT' }));
    await expect(triggerIngest({ sheetId: 's' })).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError when no response', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ response: false }));
    await expect(triggerIngest({ sheetId: 's' })).rejects.toThrow(UnavailableError);
  });

  it('throws RateLimitError on 429', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 429 }));
    await expect(triggerIngest({ sheetId: 's' })).rejects.toThrow(RateLimitError);
  });

  it('throws UnavailableError on 500', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 500 }));
    await expect(triggerIngest({ sheetId: 's' })).rejects.toThrow(UnavailableError);
  });

  it('throws DownstreamError on 400', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 400 }));
    await expect(triggerIngest({ sheetId: 's' })).rejects.toThrow(DownstreamError);
  });

  it('throws DownstreamError on non-axios error', async () => {
    mockPost.mockRejectedValue(new Error('network failure'));
    await expect(triggerIngest({ sheetId: 's' })).rejects.toThrow(DownstreamError);
  });
});
