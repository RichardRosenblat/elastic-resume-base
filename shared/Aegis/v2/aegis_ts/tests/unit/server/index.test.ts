/**
 * Unit tests for the Aegis v2 server module barrel
 * Verifies all expected exports are present and that RequestContext is correctly typed.
 */

import {
  initializeAuth,
  terminateAuth,
  getTokenVerifier,
  _setTokenVerifier,
  _resetTokenVerifier,
} from '../../../src/server/index.js';
import type { RequestContext } from '../../../src/server/index.js';

describe('server module exports', () => {
  it('exports initializeAuth function', () => {
    expect(typeof initializeAuth).toBe('function');
  });

  it('exports terminateAuth function', () => {
    expect(typeof terminateAuth).toBe('function');
  });

  it('exports getTokenVerifier function', () => {
    expect(typeof getTokenVerifier).toBe('function');
  });

  it('exports _setTokenVerifier function', () => {
    expect(typeof _setTokenVerifier).toBe('function');
  });

  it('exports _resetTokenVerifier function', () => {
    expect(typeof _resetTokenVerifier).toBe('function');
  });
});

describe('RequestContext type', () => {
  it('accepts a valid RequestContext object', () => {
    const ctx: RequestContext = { uid: 'user-123', email: 'user@example.com' };
    expect(ctx.uid).toBe('user-123');
    expect(ctx.email).toBe('user@example.com');
  });

  it('accepts a RequestContext with only uid (all optional fields omitted)', () => {
    const ctx: RequestContext = { uid: 'user-456' };
    expect(ctx.uid).toBe('user-456');
    expect(ctx.email).toBeUndefined();
    expect(ctx.name).toBeUndefined();
    expect(ctx.picture).toBeUndefined();
  });

  it('accepts a RequestContext with all fields', () => {
    const ctx: RequestContext = {
      uid: 'user-789',
      email: 'full@example.com',
      name: 'Full User',
      picture: 'https://example.com/photo.jpg',
    };
    expect(ctx.uid).toBe('user-789');
    expect(ctx.name).toBe('Full User');
    expect(ctx.picture).toBe('https://example.com/photo.jpg');
  });
});
