/**
 * Unit tests for bff-gateway documentReaderClient — focusing on the ocrDocuments
 * error-handling behaviour.
 *
 * In particular this suite verifies that:
 * - 5xx errors from the document-reader are surfaced as DownstreamError (not
 *   UnavailableError) and include the actual message from the response body.
 * - 429 rate-limit responses are forwarded as RateLimitError.
 * - Network-level errors (ECONNABORTED, no response) become UnavailableError.
 */

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before any `import … from` that touches the module
// under test.
// ---------------------------------------------------------------------------

jest.mock('../../../src/config', () => ({
  config: {
    documentReaderServiceUrl: 'http://localhost:8004',
    requestTimeoutMs: 30000,
    nodeEnv: 'test',
  },
}));

const mockPost = jest.fn();

jest.mock('../../../src/utils/httpClient', () => ({
  createHttpClient: () => ({
    post: mockPost,
  }),
}));

import { DownstreamError, RateLimitError, UnavailableError } from '../../../src/errors.js';
import { ocrDocuments } from '../../../src/services/documentReaderClient.js';
import type { IncomingMessage } from 'node:http';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal AxiosError with a given HTTP status and response body. */
function makeAxiosError(
  status: number,
  body: unknown,
  code?: string,
  hasResponse = true,
): Error {
  const err = new Error(`Request failed with status code ${status}`) as Error & {
    isAxiosError: boolean;
    response?: { status: number; data: unknown; headers: Record<string, string> };
    code?: string;
  };
  Object.defineProperty(err, 'isAxiosError', { value: true });
  if (hasResponse) {
    err.response = { status, data: body, headers: {} };
  }
  if (code) {
    err.code = code;
  }
  return err;
}

const fakeStream = {} as IncomingMessage;
const fakeContentType = 'multipart/form-data; boundary=----boundary';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('documentReaderClient — ocrDocuments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns data on success', async () => {
    const excelBuffer = Buffer.from('fake-excel');
    mockPost.mockResolvedValueOnce({
      headers: { 'content-disposition': 'attachment; filename=out.xlsx' },
      data: excelBuffer,
    });

    const result = await ocrDocuments(fakeStream, fakeContentType);
    expect(result.data).toEqual(excelBuffer);
  });

  it('throws UnavailableError when there is no response (network error)', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosError(0, null, undefined, false));

    await expect(ocrDocuments(fakeStream, fakeContentType)).rejects.toBeInstanceOf(UnavailableError);
  });

  it('throws UnavailableError on ECONNABORTED', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosError(0, null, 'ECONNABORTED', false));

    await expect(ocrDocuments(fakeStream, fakeContentType)).rejects.toBeInstanceOf(UnavailableError);
  });

  it('throws UnavailableError on ETIMEDOUT', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosError(0, null, 'ETIMEDOUT', false));

    await expect(ocrDocuments(fakeStream, fakeContentType)).rejects.toBeInstanceOf(UnavailableError);
  });

  it('throws RateLimitError on 429', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosError(429, {}));

    await expect(ocrDocuments(fakeStream, fakeContentType)).rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws DownstreamError (not UnavailableError) on 502 and includes the response message', async () => {
    const errorMessage = 'Vision API call failed: 504 Deadline Exceeded';
    mockPost.mockRejectedValueOnce(
      makeAxiosError(502, { error: { message: errorMessage } }),
    );

    let thrown: unknown;
    try {
      await ocrDocuments(fakeStream, fakeContentType);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(DownstreamError);
    expect(thrown).not.toBeInstanceOf(UnavailableError);
    expect((thrown as DownstreamError).message).toBe(errorMessage);
  });

  it('throws DownstreamError with fallback message when 5xx body has no error.message', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosError(503, {}));

    let thrown: unknown;
    try {
      await ocrDocuments(fakeStream, fakeContentType);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(DownstreamError);
    expect((thrown as DownstreamError).message).toBe('DocumentReader service error');
  });

  it('throws DownstreamError with actual message on 400', async () => {
    const errorMessage = "Unsupported file type '.exe'. Allowed: .docx, .jpg, .pdf, .png";
    mockPost.mockRejectedValueOnce(
      makeAxiosError(400, { error: { message: errorMessage } }),
    );

    let thrown: unknown;
    try {
      await ocrDocuments(fakeStream, fakeContentType);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(DownstreamError);
    expect((thrown as DownstreamError).message).toBe(errorMessage);
  });

  it('throws DownstreamError on unexpected (non-Axios) errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('unexpected'));

    await expect(ocrDocuments(fakeStream, fakeContentType)).rejects.toBeInstanceOf(DownstreamError);
  });
});
