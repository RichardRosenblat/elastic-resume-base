/**
 * Unit tests for createHttpClient — verifies that the Axios request interceptor
 * injects `x-correlation-id` and `x-cloud-trace-context` headers from the
 * tracing context stored in AsyncLocalStorage.
 */

jest.mock('../../../src/config', () => ({
  config: {
    requestTimeoutMs: 5000,
    nodeEnv: 'test',
  },
}));

// Mock Harbor so we don't need axios installed as a direct dependency in tests.
const mockInterceptorsRequestUse = jest.fn();
const mockClient = {
  interceptors: {
    request: { use: mockInterceptorsRequestUse },
  },
};

jest.mock('@elastic-resume-base/harbor/server', () => ({
  createHarborClient: jest.fn(() => mockClient),
}));

import { createHttpClient } from '../../../src/utils/httpClient.js';
import { tracingStorage } from '../../../src/utils/tracingContext.js';

describe('createHttpClient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers a request interceptor on the created client', () => {
    createHttpClient('http://localhost:9000');
    expect(mockInterceptorsRequestUse).toHaveBeenCalledTimes(1);
    expect(mockInterceptorsRequestUse).toHaveBeenCalledWith(expect.any(Function));
  });

  it('interceptor injects tracing headers when a context is stored', () => {
    createHttpClient('http://localhost:9000');
    const interceptorFn = (mockInterceptorsRequestUse as jest.Mock).mock.calls[0][0] as (
      config: { headers: Record<string, string | undefined> },
    ) => { headers: Record<string, string | undefined> };

    const axiosConfig = { headers: {} as Record<string, string | undefined> };
    let result: ReturnType<typeof interceptorFn> | undefined;

    tracingStorage.run(
      { correlationId: 'test-cid', traceId: 'abc123def456abc123def456abc123de', spanId: '42' },
      () => {
        result = interceptorFn(axiosConfig);
      },
    );

    expect(result!.headers['x-correlation-id']).toBe('test-cid');
    expect(result!.headers['x-cloud-trace-context']).toBe(
      'abc123def456abc123def456abc123de/42;o=1',
    );
  });

  it('interceptor does not add headers when no context is stored', () => {
    createHttpClient('http://localhost:9000');
    const interceptorFn = (mockInterceptorsRequestUse as jest.Mock).mock.calls[0][0] as (
      config: { headers: Record<string, string | undefined> },
    ) => { headers: Record<string, string | undefined> };

    const axiosConfig = { headers: {} as Record<string, string | undefined> };
    // Call outside of any tracingStorage.run() context
    const result = interceptorFn(axiosConfig);

    expect(result.headers['x-correlation-id']).toBeUndefined();
    expect(result.headers['x-cloud-trace-context']).toBeUndefined();
  });
});
