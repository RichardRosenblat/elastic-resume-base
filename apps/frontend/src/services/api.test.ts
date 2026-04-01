/**
 * @file api.test.ts — Unit tests for the apiClient Axios instance.
 *
 * Focuses on the request interceptor that attaches the x-correlation-id header
 * to every outbound request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';

// ─── Module mocks (must be hoisted before imports) ──────────────────────────

vi.mock('../firebase', () => ({
  auth: { getCurrentUser: () => null },
}));

vi.mock('../config', () => ({
  config: {
    gatewayApiUrl: 'http://localhost:3000',
    features: {
      resumeIngest: false,
      resumeSearch: false,
      documentRead: false,
      resumeGenerate: false,
    },
  },
}));

vi.mock('./api-error', () => ({
  ensureApiRequestError: (e: unknown, msg?: string) => {
    const err = e instanceof Error ? e : new Error(String(e));
    return Object.assign(new Error(msg ?? err.message), { status: undefined, code: undefined });
  },
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import apiClient from './api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Makes a GET request through the full interceptor chain using a no-op
 * adapter so no real network call is made. Returns the request config seen
 * by the adapter (i.e. after all request interceptors have run).
 */
function captureRequestConfig(url = '/test'): Promise<InternalAxiosRequestConfig> {
  return apiClient
    .get(url, {
      adapter: (config: InternalAxiosRequestConfig) =>
        Promise.resolve({
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
    })
    .then((res) => res.config);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('apiClient — x-correlation-id header', () => {
  beforeEach(() => {
    // Reset rate-limit tracking between tests by advancing time far enough
    // that old timestamps fall outside the 10-second window.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 15_000);
    vi.useRealTimers();
  });

  it('attaches a UUID v4 x-correlation-id to every request', async () => {
    const config = await captureRequestConfig('/api/v1/users/me');
    const correlationId = config.headers['x-correlation-id'] as string;

    expect(correlationId).toMatch(UUID_V4_RE);
  });

  it('generates a different correlation ID for each request', async () => {
    const [config1, config2] = await Promise.all([
      captureRequestConfig('/api/v1/users/1'),
      captureRequestConfig('/api/v1/users/2'),
    ]);

    const id1 = config1.headers['x-correlation-id'] as string;
    const id2 = config2.headers['x-correlation-id'] as string;

    expect(id1).toMatch(UUID_V4_RE);
    expect(id2).toMatch(UUID_V4_RE);
    expect(id1).not.toBe(id2);
  });

  it('does NOT attach an x-cloud-trace-context header', async () => {
    const config = await captureRequestConfig('/api/v1/users/me');

    expect(config.headers['x-cloud-trace-context']).toBeUndefined();
  });
});
