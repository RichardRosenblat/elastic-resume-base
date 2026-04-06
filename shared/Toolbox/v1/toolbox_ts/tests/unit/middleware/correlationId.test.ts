/**
 * Unit tests for toolbox_ts middleware/correlationId module.
 */

import { randomUUID } from 'node:crypto';
import { correlationIdHook, createCorrelationIdHook } from '../../../src/middleware/correlationId.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface MockRequest {
  headers: Record<string, string | undefined>;
  correlationId: string;
  traceId: string;
  spanId: string;
}

interface MockReply {
  headers: Record<string, string>;
  header(key: string, value: string): MockReply;
}

function makeMockReply(): MockReply {
  const reply: MockReply = {
    headers: {},
    header(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  };
  return reply;
}

function makeRequest(headers: Record<string, string | undefined> = {}): MockRequest {
  return { headers, correlationId: '', traceId: '', spanId: '' };
}

function runHook(
  reqHeaders: Record<string, string | undefined> = {},
  logger?: Parameters<typeof createCorrelationIdHook>[0],
): { request: MockRequest; reply: MockReply } {
  const hook = createCorrelationIdHook(logger);
  const request = makeRequest(reqHeaders);
  const reply = makeMockReply();
  hook(request as Parameters<typeof hook>[0], reply as Parameters<typeof hook>[1], () => undefined);
  return { request, reply };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createCorrelationIdHook — correlation ID resolution', () => {
  it('uses the existing x-correlation-id header when present', () => {
    const { request, reply } = runHook({ 'x-correlation-id': 'existing-123' });
    expect(request.correlationId).toBe('existing-123');
    expect(reply.headers['x-correlation-id']).toBe('existing-123');
  });

  it('generates a UUID v4 when x-correlation-id is absent', () => {
    const { request } = runHook();
    expect(request.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('sets x-correlation-id response header', () => {
    const { reply } = runHook({ 'x-correlation-id': 'my-id' });
    expect(reply.headers['x-correlation-id']).toBe('my-id');
  });
});

describe('createCorrelationIdHook — Cloud Trace context parsing', () => {
  const traceId = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

  it('parses a valid x-cloud-trace-context header', () => {
    const { request } = runHook({ 'x-cloud-trace-context': `${traceId}/99;o=1` });
    expect(request.traceId).toBe(traceId);
    expect(request.spanId).toBe('99');
  });

  it('lowercases the trace ID', () => {
    const upper = traceId.toUpperCase();
    const { request } = runHook({ 'x-cloud-trace-context': `${upper}/1;o=1` });
    expect(request.traceId).toBe(traceId);
  });

  it('echoes x-cloud-trace-context header in response', () => {
    const { reply } = runHook({ 'x-cloud-trace-context': `${traceId}/7;o=1` });
    expect(reply.headers['x-cloud-trace-context']).toBe(`${traceId}/7;o=1`);
  });

  it('derives trace context from correlation ID when trace header is absent', () => {
    const correlationId = '550e8400-e29b-41d4-a716-446655440000';
    const expectedTraceId = '550e8400e29b41d4a716446655440000';
    const { request } = runHook({ 'x-correlation-id': correlationId });
    expect(request.traceId).toBe(expectedTraceId);
    expect(request.spanId).toBe('0');
  });

  it('falls back to derived trace when x-cloud-trace-context is malformed', () => {
    const correlationId = randomUUID();
    const expectedTraceId = correlationId.replace(/-/g, '');
    const { request } = runHook({
      'x-correlation-id': correlationId,
      'x-cloud-trace-context': 'invalid-header-value',
    });
    expect(request.traceId).toBe(expectedTraceId);
    expect(request.spanId).toBe('0');
  });

  it('response x-cloud-trace-context follows TRACE_ID/SPAN_ID;o=1 format', () => {
    const { reply } = runHook();
    expect(reply.headers['x-cloud-trace-context']).toMatch(/^[0-9a-f]{32}\/[0-9]+;o=1$/);
  });
});

describe('createCorrelationIdHook — logger warnings', () => {
  it('warns when x-correlation-id header is absent', () => {
    const warn = jest.fn();
    runHook({}, { warn });
    const messages = (warn.mock.calls as Array<[Record<string, unknown>, string]>).map(
      ([, msg]) => msg,
    );
    expect(messages.some((m) => m.includes('x-correlation-id'))).toBe(true);
  });

  it('warns when x-cloud-trace-context header is absent', () => {
    const warn = jest.fn();
    runHook({ 'x-correlation-id': 'existing-id' }, { warn });
    const messages = (warn.mock.calls as Array<[Record<string, unknown>, string]>).map(
      ([, msg]) => msg,
    );
    expect(messages.some((m) => m.includes('x-cloud-trace-context'))).toBe(true);
  });

  it('does not warn when both headers are present', () => {
    const traceId = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const warn = jest.fn();
    runHook(
      {
        'x-correlation-id': 'existing-id',
        'x-cloud-trace-context': `${traceId}/1;o=1`,
      },
      { warn },
    );
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('correlationIdHook (default export without logger)', () => {
  it('is a function', () => {
    expect(typeof correlationIdHook).toBe('function');
  });

  it('processes requests without throwing', () => {
    const request = makeRequest();
    const reply = makeMockReply();
    expect(() => {
      correlationIdHook(
        request as Parameters<typeof correlationIdHook>[0],
        reply as Parameters<typeof correlationIdHook>[1],
        () => undefined,
      );
    }).not.toThrow();
  });

  it('attaches a correlation ID to the request', () => {
    const request = makeRequest();
    const reply = makeMockReply();
    correlationIdHook(
      request as Parameters<typeof correlationIdHook>[0],
      reply as Parameters<typeof correlationIdHook>[1],
      () => undefined,
    );
    expect(request.correlationId).toBeTruthy();
  });
});
