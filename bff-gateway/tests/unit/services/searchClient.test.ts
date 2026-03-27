/**
 * Unit tests for bff-gateway searchClient — covers search,
 * including success paths and all error branches.
 */

jest.mock('../../../src/config', () => ({
  config: {
    searchBaseServiceUrl: 'http://localhost:8002',
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
import { search } from '../../../src/services/searchClient.js';

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

describe('searchClient – search', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns SearchResponse on success', async () => {
    const fakeResponse = { results: [{ id: '1', score: 0.9 }] };
    mockPost.mockResolvedValue({ data: fakeResponse });

    const result = await search({ query: 'software engineer' });
    expect(result).toEqual(fakeResponse);
    expect(mockPost).toHaveBeenCalledWith('/search', { query: 'software engineer' });
  });

  it('returns SearchResponse with limit and offset', async () => {
    const fakeResponse = { results: [] };
    mockPost.mockResolvedValue({ data: fakeResponse });

    const result = await search({ query: 'developer', limit: 10, offset: 5 });
    expect(result).toEqual(fakeResponse);
  });

  it('throws UnavailableError on ECONNABORTED', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ECONNABORTED' }));
    await expect(search({ query: 'q' })).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError on ETIMEDOUT', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ETIMEDOUT' }));
    await expect(search({ query: 'q' })).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError when no response', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ response: false }));
    await expect(search({ query: 'q' })).rejects.toThrow(UnavailableError);
  });

  it('throws RateLimitError on 429', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 429 }));
    await expect(search({ query: 'q' })).rejects.toThrow(RateLimitError);
  });

  it('throws UnavailableError on 500', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 500 }));
    await expect(search({ query: 'q' })).rejects.toThrow(UnavailableError);
  });

  it('throws DownstreamError on 400', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 400 }));
    await expect(search({ query: 'q' })).rejects.toThrow(DownstreamError);
  });

  it('throws DownstreamError on non-axios error', async () => {
    mockPost.mockRejectedValue(new Error('network failure'));
    await expect(search({ query: 'q' })).rejects.toThrow(DownstreamError);
  });
});
