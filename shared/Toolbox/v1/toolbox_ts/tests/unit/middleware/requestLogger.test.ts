/**
 * Unit tests for toolbox_ts middleware/requestLogger module.
 */

import { createRequestLoggerHook } from '../../../src/middleware/requestLogger.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface MockRequest {
  method: string;
  url: string;
  correlationId: string;
  traceId: string;
  spanId: string;
}

interface MockReply {
  statusCode: number;
  elapsedTime: number;
}

function makeRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    method: 'GET',
    url: '/api/v1/users',
    correlationId: 'test-correlation-id',
    traceId: 'traceid32chars00000000000000000',
    spanId: '0',
    ...overrides,
  };
}

function makeReply(overrides: Partial<MockReply> = {}): MockReply {
  return {
    statusCode: 200,
    elapsedTime: 42.7,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createRequestLoggerHook', () => {
  it('returns a function', () => {
    const logger = { info: jest.fn() };
    const hook = createRequestLoggerHook(logger);
    expect(typeof hook).toBe('function');
  });

  it('calls logger.info once per request', () => {
    const logger = { info: jest.fn() };
    const hook = createRequestLoggerHook(logger);
    hook(makeRequest() as Parameters<typeof hook>[0], makeReply() as Parameters<typeof hook>[1], () => undefined);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('logs method, path, statusCode, durationMs, correlationId, traceId, spanId', () => {
    const logger = { info: jest.fn() };
    const hook = createRequestLoggerHook(logger);
    const req = makeRequest({ method: 'POST', url: '/api/v1/data', correlationId: 'c-id', traceId: 'trace', spanId: '5' });
    const rep = makeReply({ statusCode: 201, elapsedTime: 15.3 });
    hook(req as Parameters<typeof hook>[0], rep as Parameters<typeof hook>[1], () => undefined);

    const [logData, msg] = (logger.info.mock.calls[0] as [Record<string, unknown>, string]);
    expect(msg).toBe('HTTP request');
    expect(logData['method']).toBe('POST');
    expect(logData['path']).toBe('/api/v1/data');
    expect(logData['statusCode']).toBe(201);
    expect(logData['durationMs']).toBe(15);
    expect(logData['correlationId']).toBe('c-id');
    expect(logData['traceId']).toBe('trace');
    expect(logData['spanId']).toBe('5');
  });

  it('rounds elapsedTime to the nearest integer for durationMs', () => {
    const logger = { info: jest.fn() };
    const hook = createRequestLoggerHook(logger);
    hook(
      makeRequest() as Parameters<typeof hook>[0],
      makeReply({ elapsedTime: 99.9 }) as Parameters<typeof hook>[1],
      () => undefined,
    );
    const [logData] = (logger.info.mock.calls[0] as [Record<string, unknown>, string]);
    expect(logData['durationMs']).toBe(100);
  });

  it('calls done() after logging', () => {
    const logger = { info: jest.fn() };
    const hook = createRequestLoggerHook(logger);
    const done = jest.fn();
    hook(makeRequest() as Parameters<typeof hook>[0], makeReply() as Parameters<typeof hook>[1], done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('creates independent hook instances from separate createRequestLoggerHook calls', () => {
    const loggerA = { info: jest.fn() };
    const loggerB = { info: jest.fn() };
    const hookA = createRequestLoggerHook(loggerA);
    const hookB = createRequestLoggerHook(loggerB);

    hookA(makeRequest() as Parameters<typeof hookA>[0], makeReply() as Parameters<typeof hookA>[1], () => undefined);
    expect(loggerA.info).toHaveBeenCalledTimes(1);
    expect(loggerB.info).not.toHaveBeenCalled();

    hookB(makeRequest() as Parameters<typeof hookB>[0], makeReply() as Parameters<typeof hookB>[1], () => undefined);
    expect(loggerB.info).toHaveBeenCalledTimes(1);
  });
});
