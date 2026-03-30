/**
 * Unit tests for correlationIdHook.
 * Tests that the hook attaches or generates a correlation ID and Cloud Trace context on every request.
 */

import { correlationIdHook } from '../../../../../../shared/Toolbox/v1/toolbox_ts/src/middleware/correlationId.js';

function makeRequest(headers: Record<string, string> = {}): {
  headers: Record<string, string>;
  correlationId: string;
  traceId: string;
  spanId: string;
} {
  return { headers, correlationId: '', traceId: '', spanId: '' };
}

function makeReply(): { _headers: Record<string, string>; header(k: string, v: string): void } {
  const _headers: Record<string, string> = {};
  return {
    _headers,
    header(key: string, value: string) {
      _headers[key] = value;
    },
  };
}

describe('correlationIdHook', () => {
  it('uses existing x-correlation-id header when present', () => {
    const request = makeRequest({ 'x-correlation-id': 'existing-id-123' });
    const reply = makeReply();
    const done = jest.fn();

    correlationIdHook(request, reply, done);

    expect(request.correlationId).toBe('existing-id-123');
    expect(reply._headers['x-correlation-id']).toBe('existing-id-123');
    expect(done).toHaveBeenCalled();
  });

  it('generates a new UUID when no x-correlation-id header is present', () => {
    const request = makeRequest({});
    const reply = makeReply();
    const done = jest.fn();

    correlationIdHook(request, reply, done);

    expect(request.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(reply._headers['x-correlation-id']).toBe(request.correlationId);
    expect(done).toHaveBeenCalled();
  });

  it('calls done() in all cases', () => {
    const request = makeRequest({ 'x-correlation-id': 'some-id' });
    const reply = makeReply();
    const done = jest.fn();

    correlationIdHook(request, reply, done);

    expect(done).toHaveBeenCalledTimes(1);
  });

  it('parses traceId and spanId from a valid x-cloud-trace-context header', () => {
    const traceId = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const spanId = '12345';
    const request = makeRequest({ 'x-cloud-trace-context': `${traceId}/${spanId};o=1` });
    const reply = makeReply();
    const done = jest.fn();

    correlationIdHook(request, reply, done);

    expect(request.traceId).toBe(traceId);
    expect(request.spanId).toBe(spanId);
    expect(reply._headers['x-cloud-trace-context']).toBe(`${traceId}/${spanId};o=1`);
  });

  it('derives traceId from correlationId when x-cloud-trace-context header is absent', () => {
    const correlationId = '550e8400-e29b-41d4-a716-446655440000';
    const request = makeRequest({ 'x-correlation-id': correlationId });
    const reply = makeReply();
    const done = jest.fn();

    correlationIdHook(request, reply, done);

    expect(request.traceId).toBe('550e8400e29b41d4a716446655440000');
    expect(request.spanId).toBe('0');
    expect(reply._headers['x-cloud-trace-context']).toBe(
      '550e8400e29b41d4a716446655440000/0;o=1',
    );
  });

  it('ignores a malformed x-cloud-trace-context header and falls back to derived trace', () => {
    const correlationId = '550e8400-e29b-41d4-a716-446655440000';
    const request = makeRequest({
      'x-correlation-id': correlationId,
      'x-cloud-trace-context': 'not-valid-trace-header',
    });
    const reply = makeReply();
    const done = jest.fn();

    correlationIdHook(request, reply, done);

    expect(request.traceId).toBe('550e8400e29b41d4a716446655440000');
    expect(request.spanId).toBe('0');
  });

  it('sets x-cloud-trace-context response header with o=1 (tracing enabled)', () => {
    const request = makeRequest({});
    const reply = makeReply();
    const done = jest.fn();

    correlationIdHook(request, reply, done);

    expect(reply._headers['x-cloud-trace-context']).toMatch(/^[0-9a-f]{32}\/[0-9]+;o=1$/);
  });
});
