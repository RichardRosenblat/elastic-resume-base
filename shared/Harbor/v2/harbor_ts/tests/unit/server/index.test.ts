/**
 * Unit tests for @elastic-resume-base/harbor/server (v2) — server-side module.
 *
 * Verifies that the server module exports both basic and IAM-authenticated
 * client factories.  The GoogleAuth call is mocked so no real GCP credentials
 * are required.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getIdTokenClient: jest.fn().mockResolvedValue({
      getRequestHeaders: jest.fn().mockResolvedValue({
        get: jest.fn().mockReturnValue('Bearer mock-oidc-token'),
      }),
    }),
  })),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import {
  createHarborClient,
  createIamHarborClient,
  isHarborError,
} from '../../../src/server/index.js';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('server module — createHarborClient', () => {
  it('returns an object with standard HTTP method functions', () => {
    const client = createHarborClient({ baseURL: 'http://localhost:8000' });

    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.request).toBe('function');
  });

  it('sets the provided baseURL', () => {
    const client = createHarborClient({ baseURL: 'http://users-api:8005' });
    expect(client.defaults.baseURL).toBe('http://users-api:8005');
  });

  it('sets the provided timeout when timeoutMs is given', () => {
    const client = createHarborClient({ baseURL: 'http://service', timeoutMs: 5000 });
    expect(client.defaults.timeout).toBe(5000);
  });
});

describe('server module — createIamHarborClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an Axios instance', () => {
    const client = createIamHarborClient({
      baseURL: 'http://service',
      audience: 'https://service.run.app',
    });

    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
  });

  it('sets the provided baseURL', () => {
    const client = createIamHarborClient({
      baseURL: 'http://users-api:8005',
      audience: 'https://users-api.run.app',
    });
    expect(client.defaults.baseURL).toBe('http://users-api:8005');
  });

  it('creates a GoogleAuth instance for IAM token acquisition', () => {
    createIamHarborClient({
      baseURL: 'http://service',
      audience: 'https://service.run.app',
    });
    expect(GoogleAuth).toHaveBeenCalledTimes(1);
  });

  it('attaches an IAM token via a request interceptor', async () => {
    const client = createIamHarborClient({
      baseURL: 'http://service',
      audience: 'https://service.run.app',
    });

    // Invoke the request interceptor by running the interceptor handlers
    const interceptorManager = client.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: Record<string, unknown>) => Promise<Record<string, unknown>> } | null>;
    };

    const handler = interceptorManager.handlers.find((h) => h !== null);
    expect(handler).toBeDefined();

    const mockConfig = {
      headers: {} as Record<string, string>,
    };

    const result = await handler!.fulfilled(mockConfig);
    expect((result.headers as Record<string, string>)['Authorization']).toBe('Bearer mock-oidc-token');
  });

  it('proceeds without Authorization header when IAM token acquisition fails', async () => {
    (GoogleAuth as jest.Mock).mockImplementationOnce(() => ({
      getIdTokenClient: jest.fn().mockRejectedValue(new Error('ADC not configured')),
    }));

    const client = createIamHarborClient({
      baseURL: 'http://service',
      audience: 'https://service.run.app',
    });

    const interceptorManager = client.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: Record<string, unknown>) => Promise<Record<string, unknown>> } | null>;
    };
    const handler = interceptorManager.handlers.find((h) => h !== null);
    expect(handler).toBeDefined();

    const mockConfig = { headers: {} as Record<string, string> };
    const result = await handler!.fulfilled(mockConfig);
    // Should not have Authorization header — IAM fetch failed gracefully
    expect((result.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });
});

describe('server module — isHarborError', () => {
  it('returns true for axios errors', () => {
    const err = new axios.AxiosError('HTTP error', 'ERR_BAD_RESPONSE');
    expect(isHarborError(err)).toBe(true);
  });

  it('returns false for plain Error instances', () => {
    expect(isHarborError(new Error('plain error'))).toBe(false);
  });
});

describe('server module — all expected exports present', () => {
  it('exports createHarborClient', () => {
    expect(typeof createHarborClient).toBe('function');
  });

  it('exports createIamHarborClient', () => {
    expect(typeof createIamHarborClient).toBe('function');
  });

  it('exports isHarborError', () => {
    expect(typeof isHarborError).toBe('function');
  });
});
