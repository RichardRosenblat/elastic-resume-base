/**
 * Unit tests for @elastic-resume-base/harbor/client (v2) — browser-safe module.
 *
 * Verifies that the client module exports only the browser-safe utilities
 * and not any server-side exports (like createIamHarborClient).
 */

import axios, { type AxiosError, type AxiosResponse } from 'axios';
import { createHarborClient, isHarborError } from '../../src/client.js';

describe('client module — createHarborClient', () => {
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

describe('client module — isHarborError', () => {
  it('returns true for axios errors (with response)', () => {
    const err = new axios.AxiosError('HTTP error', 'ERR_BAD_RESPONSE');
    (err as AxiosError).response = { status: 500 } as AxiosResponse;
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
});

describe('client module — no server-only exports', () => {
  it('does not export createIamHarborClient from the client module', async () => {
    const clientModule = await import('../../src/client.js');
    expect('createIamHarborClient' in clientModule).toBe(false);
  });

  it('does not export IamHarborClientOptions from the client module', async () => {
    const clientModule = await import('../../src/client.js');
    expect('IamHarborClientOptions' in clientModule).toBe(false);
  });
});
