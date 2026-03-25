/**
 * Unit tests for the Aegis client auth module
 * (initializeClientAuth / getClientAuth / terminateClientAuth).
 *
 * FirebaseClientAuth is fully mocked so no real Firebase SDK is exercised.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../../src/firebase-client-auth', () => ({
  FirebaseClientAuth: jest.fn().mockImplementation(() => ({
    onAuthStateChanged: jest.fn().mockReturnValue(() => {}),
    signInWithEmailAndPassword: jest.fn().mockResolvedValue(undefined),
    signInWithGoogle: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
    getCurrentUser: jest.fn().mockReturnValue(null),
  })),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { FirebaseClientAuth } from '../../src/firebase-client-auth.js';
import {
  initializeClientAuth,
  terminateClientAuth,
  getClientAuth,
  _setClientAuth,
  _resetClientAuth,
} from '../../src/client-auth.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function getConstructorMock(): jest.Mock {
  return FirebaseClientAuth as jest.Mock;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('initializeClientAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetClientAuth();
  });

  it('creates a FirebaseClientAuth with the provided options', () => {
    initializeClientAuth({
      apiKey: 'test-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
    });

    expect(getConstructorMock()).toHaveBeenCalledTimes(1);
    expect(getConstructorMock()).toHaveBeenCalledWith({
      apiKey: 'test-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
    });
  });

  it('is idempotent: skips re-initialisation when already initialized', () => {
    const opts = { apiKey: 'k', authDomain: 'a', projectId: 'p' };
    initializeClientAuth(opts);
    initializeClientAuth(opts);

    expect(getConstructorMock()).toHaveBeenCalledTimes(1);
  });
});

describe('getClientAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetClientAuth();
  });

  it('returns the client auth after initializeClientAuth', () => {
    initializeClientAuth({ apiKey: 'k', authDomain: 'a', projectId: 'p' });
    const auth = getClientAuth();

    expect(auth).toBeDefined();
    expect(typeof auth.signInWithEmailAndPassword).toBe('function');
    expect(typeof auth.signInWithGoogle).toBe('function');
    expect(typeof auth.signOut).toBe('function');
    expect(typeof auth.getCurrentUser).toBe('function');
    expect(typeof auth.onAuthStateChanged).toBe('function');
  });

  it('throws when called before initializeClientAuth', () => {
    expect(() => getClientAuth()).toThrow(
      'Aegis: client auth not initialized. Call initializeClientAuth() before use.',
    );
  });

  it('returns the same instance on subsequent calls', () => {
    initializeClientAuth({ apiKey: 'k', authDomain: 'a', projectId: 'p' });
    const a = getClientAuth();
    const b = getClientAuth();

    expect(a).toBe(b);
  });
});

describe('terminateClientAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetClientAuth();
  });

  it('clears the client auth so getClientAuth throws afterwards', async () => {
    initializeClientAuth({ apiKey: 'k', authDomain: 'a', projectId: 'p' });
    await terminateClientAuth();

    expect(() => getClientAuth()).toThrow();
  });

  it('is idempotent: does not throw when called without prior initialisation', async () => {
    await expect(terminateClientAuth()).resolves.toBeUndefined();
  });
});

describe('_setClientAuth / _resetClientAuth', () => {
  beforeEach(() => {
    _resetClientAuth();
  });

  it('_setClientAuth overrides the internal instance', () => {
    const stub = {
      onAuthStateChanged: jest.fn(),
      signInWithEmailAndPassword: jest.fn(),
      signInWithGoogle: jest.fn(),
      signOut: jest.fn(),
      getCurrentUser: jest.fn(),
    };
    _setClientAuth(stub);

    expect(getClientAuth()).toBe(stub);
  });

  it('_resetClientAuth clears the internal instance', () => {
    const stub = {
      onAuthStateChanged: jest.fn(),
      signInWithEmailAndPassword: jest.fn(),
      signInWithGoogle: jest.fn(),
      signOut: jest.fn(),
      getCurrentUser: jest.fn(),
    };
    _setClientAuth(stub);
    _resetClientAuth();

    expect(() => getClientAuth()).toThrow();
  });
});
