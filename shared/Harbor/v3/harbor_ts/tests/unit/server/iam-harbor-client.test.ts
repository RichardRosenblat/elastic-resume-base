/**
 * Unit tests for IamHarborClient (v3) — IAM-authenticated HTTP client.
 *
 * GoogleAuth is mocked so no real GCP credentials are required.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getIdTokenClient: jest.fn().mockResolvedValue({
      getRequestHeaders: jest.fn().mockResolvedValue(
        new Headers({ authorization: 'Bearer mock-oidc-token' }),
      ),
    }),
  })),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { GoogleAuth } from 'google-auth-library';
import { HarborClient } from '../../../src/client/harbor-client.js';
import { IamHarborClient } from '../../../src/server/iam-harbor-client.js';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('IamHarborClient — constructor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is an instance of HarborClient (extends it)', () => {
    const client = new IamHarborClient({
      baseURL: 'http://service',
      audience: 'https://service.run.app',
    });
    expect(client).toBeInstanceOf(HarborClient);
  });

  it('exposes standard HTTP method functions', () => {
    const client = new IamHarborClient({
      baseURL: 'http://service',
      audience: 'https://service.run.app',
    });
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.request).toBe('function');
  });

  it('sets the provided baseURL', () => {
    const client = new IamHarborClient({
      baseURL: 'http://users-api:8005',
      audience: 'https://users-api.run.app',
    });
    expect(client.axiosInstance.defaults.baseURL).toBe('http://users-api:8005');
  });

  it('creates a GoogleAuth instance', () => {
    new IamHarborClient({ baseURL: 'http://service', audience: 'https://service.run.app' });
    expect(GoogleAuth).toHaveBeenCalledTimes(1);
  });

  it('attaches an IAM token via a request interceptor', async () => {
    const client = new IamHarborClient({
      baseURL: 'http://service',
      audience: 'https://service.run.app',
    });

    const interceptorManager = client.axiosInstance.interceptors.request as unknown as {
      handlers: Array<{
        fulfilled: (config: Record<string, unknown>) => Promise<Record<string, unknown>>;
      } | null>;
    };

    const handler = interceptorManager.handlers.find((h) => h !== null);
    expect(handler).toBeDefined();

    const mockConfig = { headers: {} as Record<string, string> };
    const result = await handler!.fulfilled(mockConfig);
    expect((result['headers'] as Record<string, string>)['Authorization']).toBe(
      'Bearer mock-oidc-token',
    );
  });

  it('proceeds without Authorization header when IAM token acquisition fails', async () => {
    (GoogleAuth as jest.Mock).mockImplementationOnce(() => ({
      getIdTokenClient: jest.fn().mockRejectedValue(new Error('ADC not configured')),
    }));

    const client = new IamHarborClient({
      baseURL: 'http://service',
      audience: 'https://service.run.app',
    });

    const interceptorManager = client.axiosInstance.interceptors.request as unknown as {
      handlers: Array<{
        fulfilled: (config: Record<string, unknown>) => Promise<Record<string, unknown>>;
      } | null>;
    };
    const handler = interceptorManager.handlers.find((h) => h !== null);
    const mockConfig = { headers: {} as Record<string, string> };
    const result = await handler!.fulfilled(mockConfig);
    expect((result['headers'] as Record<string, string>)['Authorization']).toBeUndefined();
  });
});
