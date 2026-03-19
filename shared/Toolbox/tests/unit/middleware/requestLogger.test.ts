/**
 * Unit tests for createRequestLoggerHook.
 * Tests that the factory returns a hook that logs HTTP request details.
 */

import type { Logger } from 'pino';
import { createRequestLoggerHook } from '../../../src/middleware/requestLogger.js';

function makeRequest(overrides: Record<string, unknown> = {}): {
  method: string;
  url: string;
  correlationId: string;
} {
  return {
    method: 'GET',
    url: '/api/v1/users',
    correlationId: 'test-correlation-id',
    ...overrides,
  };
}

function makeReply(overrides: Record<string, unknown> = {}): { statusCode: number; elapsedTime: number } {
  return {
    statusCode: 200,
    elapsedTime: 42.7,
    ...overrides,
  };
}

describe('createRequestLoggerHook', () => {
  it('logs an info entry with request details', () => {
    const mockLogger = { info: jest.fn() } as unknown as Logger;
    const hook = createRequestLoggerHook(mockLogger);
    const done = jest.fn();

    hook(makeRequest(), makeReply(), done);

    expect(mockLogger.info).toHaveBeenCalledWith(
      {
        method: 'GET',
        path: '/api/v1/users',
        statusCode: 200,
        durationMs: 43,
        correlationId: 'test-correlation-id',
      },
      'HTTP request',
    );
    expect(done).toHaveBeenCalled();
  });

  it('rounds elapsedTime to the nearest millisecond', () => {
    const mockLogger = { info: jest.fn() } as unknown as Logger;
    const hook = createRequestLoggerHook(mockLogger);
    const done = jest.fn();

    hook(makeRequest(), makeReply({ elapsedTime: 99.4 }), done);

    const callArg = (mockLogger.info as jest.Mock).mock.calls[0]?.[0] as { durationMs: number };
    expect(callArg.durationMs).toBe(99);
  });

  it('always calls done()', () => {
    const mockLogger = { info: jest.fn() } as unknown as Logger;
    const hook = createRequestLoggerHook(mockLogger);
    const done = jest.fn();

    hook(makeRequest(), makeReply(), done);

    expect(done).toHaveBeenCalledTimes(1);
  });
});
