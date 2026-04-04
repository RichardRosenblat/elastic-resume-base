/**
 * Unit tests for ServerHarborClient (v3) — environment-aware HTTP client.
 *
 * Verifies that NODE_ENV drives the transport selection:
 *   - development (or unset): plain HarborClient (no IAM interceptor)
 *   - production: IamHarborClient (with IAM interceptor)
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getIdTokenClient: jest.fn().mockResolvedValue({
      idTokenProvider: {
        fetchIdToken: jest.fn().mockResolvedValue('mock-oidc-token'),
      },
    }),
  })),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { GoogleAuth } from 'google-auth-library';
import { HarborClient } from '../../../src/client/harbor-client.js';
import { ServerHarborClient } from '../../../src/server/server-harbor-client.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const setNodeEnv = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env['NODE_ENV'];
  } else {
    process.env['NODE_ENV'] = value;
  }
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ServerHarborClient — always a HarborClient subclass', () => {
  afterEach(() => {
    setNodeEnv('test');
    jest.clearAllMocks();
  });

  it('is an instance of HarborClient', () => {
    setNodeEnv('development');
    const client = new ServerHarborClient({ baseURL: 'http://service' });
    expect(client).toBeInstanceOf(HarborClient);
  });
});

describe('ServerHarborClient — development mode', () => {
  afterEach(() => {
    jest.clearAllMocks();
    setNodeEnv('test');
  });

  it('exposes HTTP method functions in development', () => {
    setNodeEnv('development');
    const client = new ServerHarborClient({ baseURL: 'http://service' });
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
  });

  it('does not create a GoogleAuth instance in development', () => {
    setNodeEnv('development');
    new ServerHarborClient({ baseURL: 'http://service' });
    expect(GoogleAuth).not.toHaveBeenCalled();
  });

  it('sets baseURL in development', () => {
    setNodeEnv('development');
    const client = new ServerHarborClient({ baseURL: 'http://users-api:8005' });
    expect(client.axiosInstance.defaults.baseURL).toBe('http://users-api:8005');
  });

  it('sets timeout in development', () => {
    setNodeEnv('development');
    const client = new ServerHarborClient({ baseURL: 'http://service', timeoutMs: 3000 });
    expect(client.axiosInstance.defaults.timeout).toBe(3000);
  });

  it('does not add IAM interceptor in development', () => {
    setNodeEnv('development');
    const client = new ServerHarborClient({ baseURL: 'http://service' });
    const mgr = client.axiosInstance.interceptors.request as unknown as {
      handlers: Array<unknown | null>;
    };
    const hasHandlers = mgr.handlers.some((h) => h !== null);
    expect(hasHandlers).toBe(false);
  });

  it('behaves the same when NODE_ENV is undefined', () => {
    setNodeEnv(undefined);
    const client = new ServerHarborClient({ baseURL: 'http://service' });
    expect(GoogleAuth).not.toHaveBeenCalled();
    expect(client.axiosInstance.defaults.baseURL).toBe('http://service');
  });
});

describe('ServerHarborClient — production mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNodeEnv('production');
  });

  afterEach(() => {
    setNodeEnv('test');
  });

  it('creates a GoogleAuth instance in production', () => {
    new ServerHarborClient({ baseURL: 'http://service' });
    expect(GoogleAuth).toHaveBeenCalledTimes(1);
  });

  it('sets baseURL in production', () => {
    const client = new ServerHarborClient({ baseURL: 'http://users-api:8005' });
    expect(client.axiosInstance.defaults.baseURL).toBe('http://users-api:8005');
  });

  it('attaches IAM interceptor in production', async () => {
    const client = new ServerHarborClient({ baseURL: 'https://service.run.app' });

    const mgr = client.axiosInstance.interceptors.request as unknown as {
      handlers: Array<{
        fulfilled: (config: Record<string, unknown>) => Promise<Record<string, unknown>>;
      } | null>;
    };
    const handler = mgr.handlers.find((h) => h !== null);
    expect(handler).toBeDefined();

    const mockConfig = { headers: {} as Record<string, string> };
    const result = await handler!.fulfilled(mockConfig);
    expect((result['headers'] as Record<string, string>)['Authorization']).toBe(
      'Bearer mock-oidc-token',
    );
  });

  it('defaults audience to baseURL when not provided', async () => {
    const client = new ServerHarborClient({ baseURL: 'https://service.run.app' });

    const mgr = client.axiosInstance.interceptors.request as unknown as {
      handlers: Array<{
        fulfilled: (config: Record<string, unknown>) => Promise<Record<string, unknown>>;
      } | null>;
    };
    const handler = mgr.handlers.find((h) => h !== null);
    const mockConfig = { headers: {} as Record<string, string> };
    const result = await handler!.fulfilled(mockConfig);
    expect((result['headers'] as Record<string, string>)['Authorization']).toBe(
      'Bearer mock-oidc-token',
    );
  });

  it('uses explicit audience when provided', async () => {
    const client = new ServerHarborClient({
      baseURL: 'http://internal:8000',
      audience: 'https://service.run.app',
    });

    const mgr = client.axiosInstance.interceptors.request as unknown as {
      handlers: Array<{
        fulfilled: (config: Record<string, unknown>) => Promise<Record<string, unknown>>;
      } | null>;
    };
    const handler = mgr.handlers.find((h) => h !== null);
    const mockConfig = { headers: {} as Record<string, string> };
    const result = await handler!.fulfilled(mockConfig);
    expect((result['headers'] as Record<string, string>)['Authorization']).toBe(
      'Bearer mock-oidc-token',
    );
  });
});
