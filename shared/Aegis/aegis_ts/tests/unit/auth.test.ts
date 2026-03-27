/**
 * Unit tests for Aegis auth module (initializeAuth / getTokenVerifier / terminateAuth).
 *
 * FirebaseTokenVerifier is fully mocked so no real Firebase SDK is exercised.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../src/firebase-token-verifier', () => ({
  FirebaseTokenVerifier: jest.fn().mockImplementation(() => ({
    verifyToken: jest.fn().mockResolvedValue({ uid: 'mock-uid' }),
  })),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { FirebaseTokenVerifier } from '../../src/firebase-token-verifier.js';
import {
  initializeAuth,
  terminateAuth,
  getTokenVerifier,
  _setTokenVerifier,
  _resetTokenVerifier,
} from '../../src/auth.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function getConstructorMock() {
  return FirebaseTokenVerifier as jest.Mock;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('initializeAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetTokenVerifier();
  });

  it('creates a FirebaseTokenVerifier with the provided options', () => {
    initializeAuth({ projectId: 'test-project' });

    expect(getConstructorMock()).toHaveBeenCalledTimes(1);
    expect(getConstructorMock()).toHaveBeenCalledWith({ projectId: 'test-project' });
  });

  it('is idempotent: skips re-initialisation when already initialized', () => {
    initializeAuth({ projectId: 'test-project' });
    initializeAuth({ projectId: 'test-project' });

    expect(getConstructorMock()).toHaveBeenCalledTimes(1);
  });

  it('accepts a serviceAccountKey option', () => {
    const key = JSON.stringify({ type: 'service_account' });
    initializeAuth({ projectId: 'test-project', serviceAccountKey: key });

    expect(getConstructorMock()).toHaveBeenCalledWith({ projectId: 'test-project', serviceAccountKey: key });
  });
});

describe('getTokenVerifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetTokenVerifier();
  });

  it('returns the verifier after initializeAuth', () => {
    initializeAuth({ projectId: 'test-project' });
    const verifier = getTokenVerifier();

    expect(verifier).toBeDefined();
    expect(typeof verifier.verifyToken).toBe('function');
  });

  it('throws when called before initializeAuth', () => {
    expect(() => getTokenVerifier()).toThrow(
      'Aegis: authentication not initialized. Call initializeAuth() before use.',
    );
  });

  it('returns the same instance on subsequent calls', () => {
    initializeAuth({ projectId: 'test-project' });

    const v1 = getTokenVerifier();
    const v2 = getTokenVerifier();

    expect(v1).toBe(v2);
  });
});

describe('terminateAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetTokenVerifier();
  });

  it('clears the verifier so getTokenVerifier throws afterwards', async () => {
    initializeAuth({ projectId: 'test-project' });
    await terminateAuth();

    expect(() => getTokenVerifier()).toThrow();
  });

  it('is idempotent: does not throw when called without prior initialisation', async () => {
    await expect(terminateAuth()).resolves.toBeUndefined();
  });
});

describe('_setTokenVerifier / _resetTokenVerifier', () => {
  beforeEach(() => {
    _resetTokenVerifier();
  });

  it('_setTokenVerifier overrides the internal verifier', () => {
    const mock = { verifyToken: jest.fn() };
    _setTokenVerifier(mock);

    expect(getTokenVerifier()).toBe(mock);
  });

  it('_resetTokenVerifier clears the verifier', () => {
    const mock = { verifyToken: jest.fn() };
    _setTokenVerifier(mock);
    _resetTokenVerifier();

    expect(() => getTokenVerifier()).toThrow();
  });
});
