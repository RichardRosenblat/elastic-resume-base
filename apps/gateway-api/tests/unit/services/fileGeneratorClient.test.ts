/**
 * Unit tests for gateway-api fileGeneratorClient — covers generateResume,
 * including success paths and all error branches.
 */

jest.mock('../../../src/config', () => ({
  config: {
    fileGeneratorServiceUrl: 'http://localhost:8003',
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
import { generateResume } from '../../../src/services/fileGeneratorClient.js';

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

describe('fileGeneratorClient – generateResume', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns GenerateResponse on success', async () => {
    const fakeResponse = { jobId: 'job-1', status: 'accepted', downloadUrl: 'https://example.com' };
    mockPost.mockResolvedValue({ data: fakeResponse });

    const result = await generateResume('resume-1', { format: 'pdf', language: 'en' });
    expect(result).toEqual(fakeResponse);
    expect(mockPost).toHaveBeenCalledWith('/resumes/resume-1/generate', {
      format: 'pdf',
      language: 'en',
    });
  });

  it('throws UnavailableError on ECONNABORTED', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ECONNABORTED' }));
    await expect(generateResume('r', { format: 'docx', language: 'pt' })).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError on ETIMEDOUT', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ code: 'ETIMEDOUT' }));
    await expect(generateResume('r', { format: 'pdf', language: 'en' })).rejects.toThrow(UnavailableError);
  });

  it('throws UnavailableError when no response', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ response: false }));
    await expect(generateResume('r', { format: 'html', language: 'en' })).rejects.toThrow(UnavailableError);
  });

  it('throws RateLimitError on 429', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 429 }));
    await expect(generateResume('r', { format: 'pdf', language: 'en' })).rejects.toThrow(RateLimitError);
  });

  it('throws UnavailableError on 500', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 500 }));
    await expect(generateResume('r', { format: 'pdf', language: 'en' })).rejects.toThrow(UnavailableError);
  });

  it('throws DownstreamError on 400', async () => {
    mockPost.mockRejectedValue(makeAxiosError({ status: 400 }));
    await expect(generateResume('r', { format: 'pdf', language: 'en' })).rejects.toThrow(DownstreamError);
  });

  it('throws DownstreamError on non-axios error', async () => {
    mockPost.mockRejectedValue(new Error('network failure'));
    await expect(generateResume('r', { format: 'pdf', language: 'en' })).rejects.toThrow(DownstreamError);
  });
});
