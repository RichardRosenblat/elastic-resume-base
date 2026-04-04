/**
 * Unit tests for HarborManager (v3) — client registry.
 */

import { HarborClient } from '../../../src/client/harbor-client.js';
import { HarborManager } from '../../../src/client/harbor-manager.js';

describe('HarborManager — registerClient', () => {
  it('returns a HarborClient instance', () => {
    const manager = new HarborManager();
    const client = manager.registerClient('users', { baseURL: 'http://users-api:8005' });
    expect(client).toBeInstanceOf(HarborClient);
  });

  it('stores the client under the given key', () => {
    const manager = new HarborManager();
    manager.registerClient('users', { baseURL: 'http://users-api:8005' });
    expect(manager.hasClient('users')).toBe(true);
  });

  it('applies client options correctly', () => {
    const manager = new HarborManager();
    const client = manager.registerClient('search', { baseURL: 'http://search:8002', timeoutMs: 5000 });
    expect(client.axiosInstance.defaults.baseURL).toBe('http://search:8002');
    expect(client.axiosInstance.defaults.timeout).toBe(5000);
  });

  it('replaces an existing client with the same key', () => {
    const manager = new HarborManager();
    manager.registerClient('users', { baseURL: 'http://old:8000' });
    const newClient = manager.registerClient('users', { baseURL: 'http://new:8005' });
    expect(manager.getClient('users')).toBe(newClient);
    expect(manager.size).toBe(1);
  });

  it('creates independent instances for different keys', () => {
    const manager = new HarborManager();
    manager.registerClient('users', { baseURL: 'http://users:8005' });
    manager.registerClient('search', { baseURL: 'http://search:8002' });
    const users = manager.getClient('users')!;
    const search = manager.getClient('search')!;
    expect(users.axiosInstance.defaults.baseURL).not.toBe(search.axiosInstance.defaults.baseURL);
  });
});

describe('HarborManager — getClient', () => {
  it('returns the registered client', () => {
    const manager = new HarborManager();
    const registered = manager.registerClient('users', { baseURL: 'http://users:8005' });
    const retrieved = manager.getClient('users');
    expect(retrieved).toBe(registered);
  });

  it('returns undefined for an unknown key', () => {
    const manager = new HarborManager();
    expect(manager.getClient('unknown')).toBeUndefined();
  });
});

describe('HarborManager — hasClient', () => {
  it('returns true when a client is registered', () => {
    const manager = new HarborManager();
    manager.registerClient('users', { baseURL: 'http://users:8005' });
    expect(manager.hasClient('users')).toBe(true);
  });

  it('returns false when no client is registered', () => {
    const manager = new HarborManager();
    expect(manager.hasClient('missing')).toBe(false);
  });
});

describe('HarborManager — unregisterClient', () => {
  it('removes the client and returns true', () => {
    const manager = new HarborManager();
    manager.registerClient('users', { baseURL: 'http://users:8005' });
    const result = manager.unregisterClient('users');
    expect(result).toBe(true);
    expect(manager.hasClient('users')).toBe(false);
  });

  it('returns false when the key does not exist', () => {
    const manager = new HarborManager();
    expect(manager.unregisterClient('missing')).toBe(false);
  });
});

describe('HarborManager — clear', () => {
  it('removes all registered clients', () => {
    const manager = new HarborManager();
    manager.registerClient('a', { baseURL: 'http://a' });
    manager.registerClient('b', { baseURL: 'http://b' });
    manager.clear();
    expect(manager.size).toBe(0);
    expect(manager.registeredKeys).toEqual([]);
  });
});

describe('HarborManager — registeredKeys and size', () => {
  it('registeredKeys returns all keys', () => {
    const manager = new HarborManager();
    manager.registerClient('users', { baseURL: 'http://users' });
    manager.registerClient('search', { baseURL: 'http://search' });
    expect(manager.registeredKeys).toEqual(expect.arrayContaining(['users', 'search']));
    expect(manager.registeredKeys).toHaveLength(2);
  });

  it('size returns the count of registered clients', () => {
    const manager = new HarborManager();
    expect(manager.size).toBe(0);
    manager.registerClient('a', { baseURL: 'http://a' });
    expect(manager.size).toBe(1);
    manager.registerClient('b', { baseURL: 'http://b' });
    expect(manager.size).toBe(2);
    manager.unregisterClient('a');
    expect(manager.size).toBe(1);
  });
});
