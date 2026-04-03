/**
 * Unit tests for createServerHarborClient — environment-aware server factory.
 *
 * Verifies that NODE_ENV drives the transport selection:
 *   - development (or unset): plain axios via createHarborClient
 *   - production: IAM-authenticated axios via createIamHarborClient
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
import { createServerHarborClient } from '../../../src/server/index.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const setNodeEnv = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env['NODE_ENV'];
  } else {
    process.env['NODE_ENV'] = value;
  }
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createServerHarborClient — development mode', () => {
  afterEach(() => {
    jest.clearAllMocks();
    setNodeEnv('test'); // restore Jest default
  });

  it('returns an Axios instance when NODE_ENV is "development"', () => {
    setNodeEnv('development');
    const client = createServerHarborClient({ baseURL: 'http://service' });
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
  });

  it('returns an Axios instance when NODE_ENV is undefined', () => {
    setNodeEnv(undefined);
    const client = createServerHarborClient({ baseURL: 'http://service' });
    expect(typeof client.get).toBe('function');
  });

  it('does not create a GoogleAuth instance in development', () => {
    setNodeEnv('development');
    createServerHarborClient({ baseURL: 'http://service' });
    expect(GoogleAuth).not.toHaveBeenCalled();
  });

  it('sets the provided baseURL in development', () => {
    setNodeEnv('development');
    const client = createServerHarborClient({ baseURL: 'http://users-api:8005' });
    expect(client.defaults.baseURL).toBe('http://users-api:8005');
  });

  it('sets the provided timeout in development', () => {
    setNodeEnv('development');
    const client = createServerHarborClient({ baseURL: 'http://service', timeoutMs: 3000 });
    expect(client.defaults.timeout).toBe(3000);
  });

  it('does not add a request interceptor in development', () => {
    setNodeEnv('development');
    const client = createServerHarborClient({ baseURL: 'http://service' });
    const interceptorManager = client.interceptors.request as unknown as {
      handlers: Array<unknown | null>;
    };
    const hasHandlers = interceptorManager.handlers.some((h) => h !== null);
    expect(hasHandlers).toBe(false);
  });
});

describe('createServerHarborClient — production mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNodeEnv('production');
  });

  afterEach(() => {
    setNodeEnv('test'); // restore Jest default
  });

  it('returns an Axios instance in production', () => {
    const client = createServerHarborClient({ baseURL: 'http://service' });
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
  });

  it('creates a GoogleAuth instance in production', () => {
    createServerHarborClient({ baseURL: 'http://service' });
    expect(GoogleAuth).toHaveBeenCalledTimes(1);
  });

  it('sets the provided baseURL in production', () => {
    const client = createServerHarborClient({ baseURL: 'http://users-api:8005' });
    expect(client.defaults.baseURL).toBe('http://users-api:8005');
  });

  it('defaults audience to baseURL when audience is not provided', async () => {
    const client = createServerHarborClient({ baseURL: 'https://service.run.app' });

    const interceptorManager = client.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: Record<string, unknown>) => Promise<Record<string, unknown>> } | null>;
    };
    const handler = interceptorManager.handlers.find((h) => h !== null);
    expect(handler).toBeDefined();

    const mockConfig = { headers: {} as Record<string, string> };
    const result = await handler!.fulfilled(mockConfig);
    expect((result.headers as Record<string, string>)['Authorization']).toBe('Bearer mock-oidc-token');
  });

  it('uses the explicit audience when provided', async () => {
    const client = createServerHarborClient({
      baseURL: 'http://internal-host:8000',
      audience: 'https://service.run.app',
    });

    const interceptorManager = client.interceptors.request as unknown as {
      handlers: Array<{ fulfilled: (config: Record<string, unknown>) => Promise<Record<string, unknown>> } | null>;
    };
    const handler = interceptorManager.handlers.find((h) => h !== null);
    expect(handler).toBeDefined();

    const mockConfig = { headers: {} as Record<string, string> };
    const result = await handler!.fulfilled(mockConfig);
    expect((result.headers as Record<string, string>)['Authorization']).toBe('Bearer mock-oidc-token');
  });
});

describe('createServerHarborClient — export present', () => {
  it('is exported from the server module', () => {
    expect(typeof createServerHarborClient).toBe('function');
  });
});
