/**
 * Unit tests for correlationIdHook.
 * Tests that the hook attaches or generates a correlation ID on every request.
 */

import { correlationIdHook } from '../../../../../shared/Toolbox/src/middleware/correlationId.js';

function makeRequest(headers: Record<string, string> = {}): {
  headers: Record<string, string>;
  correlationId: string;
} {
  return { headers, correlationId: '' };
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
});
