/**
 * Unit tests for the Aegis v2 client module barrel.
 * Verifies all expected v1 client exports are re-exported correctly.
 */

import {
  initializeClientAuth,
  terminateClientAuth,
  getClientAuth,
  _setClientAuth,
  _resetClientAuth,
} from '../../src/client.js';

describe('client module re-exports from v1', () => {
  it('exports initializeClientAuth function', () => {
    expect(typeof initializeClientAuth).toBe('function');
  });

  it('exports terminateClientAuth function', () => {
    expect(typeof terminateClientAuth).toBe('function');
  });

  it('exports getClientAuth function', () => {
    expect(typeof getClientAuth).toBe('function');
  });

  it('exports _setClientAuth function', () => {
    expect(typeof _setClientAuth).toBe('function');
  });

  it('exports _resetClientAuth function', () => {
    expect(typeof _resetClientAuth).toBe('function');
  });
});
