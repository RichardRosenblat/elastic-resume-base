/**
 * Unit tests for @elastic-resume-base/harbor — createHarborClient and isHarborError.
 */

import axios from 'axios';
import { createHarborClient, isHarborError } from '../../src/index.js';

describe('createHarborClient', () => {
  it('returns an object with standard HTTP method functions', () => {
    const client = createHarborClient({ baseURL: 'http://localhost:8000' });

    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.request).toBe('function');
  });

  it('sets the provided baseURL on the client defaults', () => {
    const client = createHarborClient({ baseURL: 'http://users-api:8005' });
    expect(client.defaults.baseURL).toBe('http://users-api:8005');
  });

  it('sets the provided timeout when timeoutMs is given', () => {
    const client = createHarborClient({ baseURL: 'http://service', timeoutMs: 5000 });
    expect(client.defaults.timeout).toBe(5000);
  });

  it('does not set a timeout when timeoutMs is omitted', () => {
    const client = createHarborClient({ baseURL: 'http://service' });
    // axios.create without timeout leaves it as 0 (no timeout) by default
    expect(client.defaults.timeout ?? 0).toBe(0);
  });

  it('attaches defaultHeaders to every request', () => {
    const client = createHarborClient({
      baseURL: 'http://service',
      defaultHeaders: { 'x-api-key': 'secret', 'x-custom': 'value' },
    });
    const headers = client.defaults.headers as Record<string, unknown>;
    expect(headers['x-api-key']).toBe('secret');
    expect(headers['x-custom']).toBe('value');
  });

  it('creates independent client instances', () => {
    const clientA = createHarborClient({ baseURL: 'http://service-a' });
    const clientB = createHarborClient({ baseURL: 'http://service-b' });
    expect(clientA.defaults.baseURL).not.toBe(clientB.defaults.baseURL);
  });
});

describe('isHarborError', () => {
  it('returns true for axios errors (with response)', () => {
    const err = new axios.AxiosError('HTTP error', 'ERR_BAD_RESPONSE');
    (err as axios.AxiosError).response = { status: 500 } as axios.AxiosResponse;
    expect(isHarborError(err)).toBe(true);
  });

  it('returns true for axios errors (network-level, no response)', () => {
    const err = new axios.AxiosError('Network error', 'ECONNREFUSED');
    expect(isHarborError(err)).toBe(true);
  });

  it('returns true for axios errors with ECONNABORTED code (timeout)', () => {
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

  it('returns true for manually constructed axios-like error objects', () => {
    // Simulate how tests create mock axios errors
    const err = new Error('axios error') as Error & { isAxiosError: boolean };
    err.isAxiosError = true;
    expect(isHarborError(err)).toBe(true);
  });
});
