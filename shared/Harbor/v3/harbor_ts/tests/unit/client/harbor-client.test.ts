/**
 * Unit tests for HarborClient (v3) — object-oriented HTTP client.
 */

import axios from 'axios';
import { HarborClient, isHarborError } from '../../../src/client/harbor-client.js';
import type { IHarborClient } from '../../../src/client/harbor-client.js';

describe('HarborClient — constructor and HTTP methods', () => {
  it('exposes standard HTTP method functions', () => {
    const client = new HarborClient({ baseURL: 'http://localhost:8000' });

    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.request).toBe('function');
  });

  it('sets the provided baseURL on the underlying Axios instance', () => {
    const client = new HarborClient({ baseURL: 'http://users-api:8005' });
    expect(client.axiosInstance.defaults.baseURL).toBe('http://users-api:8005');
  });

  it('sets the provided timeout when timeoutMs is given', () => {
    const client = new HarborClient({ baseURL: 'http://service', timeoutMs: 5000 });
    expect(client.axiosInstance.defaults.timeout).toBe(5000);
  });

  it('does not set a timeout when timeoutMs is omitted', () => {
    const client = new HarborClient({ baseURL: 'http://service' });
    expect(client.axiosInstance.defaults.timeout ?? 0).toBe(0);
  });

  it('attaches defaultHeaders to the Axios instance', () => {
    const client = new HarborClient({
      baseURL: 'http://service',
      defaultHeaders: { 'x-api-key': 'secret', 'x-custom': 'value' },
    });
    const headers = client.axiosInstance.defaults.headers as Record<string, unknown>;
    expect(headers['x-api-key']).toBe('secret');
    expect(headers['x-custom']).toBe('value');
  });

  it('creates independent client instances', () => {
    const clientA = new HarborClient({ baseURL: 'http://service-a' });
    const clientB = new HarborClient({ baseURL: 'http://service-b' });
    expect(clientA.axiosInstance.defaults.baseURL).not.toBe(clientB.axiosInstance.defaults.baseURL);
  });

  it('exposes axiosInstance for interceptor access', () => {
    const client = new HarborClient({ baseURL: 'http://service' });
    expect(client.axiosInstance).toBeDefined();
    expect(typeof client.axiosInstance.interceptors).toBe('object');
  });
});

describe('HarborClient — implements IHarborClient interface', () => {
  it('can be assigned to IHarborClient', () => {
    const client: IHarborClient = new HarborClient({ baseURL: 'http://service' });
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.request).toBe('function');
    expect(client.axiosInstance).toBeDefined();
  });
});

describe('isHarborError', () => {
  it('returns true for Axios errors (with response)', () => {
    const err = new axios.AxiosError('HTTP error', 'ERR_BAD_RESPONSE');
    expect(isHarborError(err)).toBe(true);
  });

  it('returns true for Axios errors (network-level, no response)', () => {
    const err = new axios.AxiosError('Network error', 'ECONNREFUSED');
    expect(isHarborError(err)).toBe(true);
  });

  it('returns true for Axios timeout errors', () => {
    const err = new axios.AxiosError('Timeout', 'ECONNABORTED');
    expect(isHarborError(err)).toBe(true);
  });

  it('returns false for plain Error instances', () => {
    expect(isHarborError(new Error('plain error'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isHarborError('string')).toBe(false);
    expect(isHarborError(42)).toBe(false);
    expect(isHarborError(null)).toBe(false);
    expect(isHarborError(undefined)).toBe(false);
    expect(isHarborError({ message: 'object' })).toBe(false);
  });
});
