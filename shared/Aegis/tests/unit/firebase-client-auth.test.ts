/**
 * Unit tests for FirebaseClientAuth.
 *
 * The Firebase client SDK (`firebase/app` and `firebase/auth`) is fully mocked
 * so no real Firebase project or emulator is needed.
 */

// ── Mocks (must be declared before any imports that trigger module initialisation) ──

jest.mock('firebase/app', () => ({
  getApps: jest.fn().mockReturnValue([]),
  getApp: jest.fn().mockReturnValue({ name: '[DEFAULT]' }),
  initializeApp: jest.fn().mockReturnValue({ name: '[DEFAULT]' }),
}));

const mockUnsubscribe = jest.fn();
const mockOnAuthStateChanged = jest.fn().mockReturnValue(mockUnsubscribe);
const mockSignInWithEmailAndPassword = jest.fn().mockResolvedValue({});
const mockSignInWithPopup = jest.fn().mockResolvedValue({});
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockGetAuth = jest.fn().mockReturnValue({ currentUser: null });
const mockConnectAuthEmulator = jest.fn();

jest.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({ providerId: 'google.com' })),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  connectAuthEmulator: (...args: unknown[]) => mockConnectAuthEmulator(...args),
}));

// ── Imports (after mock declarations) ──

import { getApps, initializeApp } from 'firebase/app';
import { FirebaseClientAuth } from '../../src/firebase-client-auth.js';

// ── Helpers ──

function getAppsMock(): jest.Mock {
  return getApps as jest.Mock;
}

function initializeAppMock(): jest.Mock {
  return initializeApp as jest.Mock;
}

const defaultOptions = {
  apiKey: 'test-api-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
};

// ── Tests ──

describe('FirebaseClientAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAppsMock().mockReturnValue([]);
    mockGetAuth.mockReturnValue({ currentUser: null });
    mockConnectAuthEmulator.mockReset();
  });

  describe('constructor', () => {
    it('calls initializeApp when no Firebase app exists yet', () => {
      getAppsMock().mockReturnValue([]);

      new FirebaseClientAuth(defaultOptions);

      expect(initializeAppMock()).toHaveBeenCalledTimes(1);
      expect(initializeAppMock()).toHaveBeenCalledWith(defaultOptions);
    });

    it('reuses an existing Firebase app instead of calling initializeApp', () => {
      getAppsMock().mockReturnValue([{ name: '[DEFAULT]' }]);

      new FirebaseClientAuth(defaultOptions);

      expect(initializeAppMock()).not.toHaveBeenCalled();
    });

    it('calls getAuth with the resolved app', () => {
      new FirebaseClientAuth(defaultOptions);

      expect(mockGetAuth).toHaveBeenCalledTimes(1);
    });

    it('does not connect to auth emulator when authEmulatorHost is not provided', () => {
      new FirebaseClientAuth(defaultOptions);

      expect(mockConnectAuthEmulator).not.toHaveBeenCalled();
    });

    it('connects to auth emulator when authEmulatorHost is provided as host:port', () => {
      new FirebaseClientAuth({
        ...defaultOptions,
        authEmulatorHost: 'localhost:9099',
      });

      expect(mockConnectAuthEmulator).toHaveBeenCalledTimes(1);
      expect(mockConnectAuthEmulator).toHaveBeenCalledWith(
        expect.anything(),
        'http://localhost:9099',
        { disableWarnings: true },
      );
    });

    it('connects to auth emulator when authEmulatorHost is provided as full URL', () => {
      new FirebaseClientAuth({
        ...defaultOptions,
        authEmulatorHost: 'http://127.0.0.1:9099',
      });

      expect(mockConnectAuthEmulator).toHaveBeenCalledTimes(1);
      expect(mockConnectAuthEmulator).toHaveBeenCalledWith(
        expect.anything(),
        'http://127.0.0.1:9099',
        { disableWarnings: true },
      );
    });
  });

  describe('onAuthStateChanged', () => {
    it('subscribes via firebase onAuthStateChanged and returns unsubscribe fn', () => {
      const clientAuth = new FirebaseClientAuth(defaultOptions);
      const listener = jest.fn();

      const unsub = clientAuth.onAuthStateChanged(listener);

      expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1);
      expect(typeof unsub).toBe('function');
    });

    it('calls the listener with null when firebase user is null', () => {
      const clientAuth = new FirebaseClientAuth(defaultOptions);
      let capturedCallback: ((user: unknown) => void) | null = null;
      mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
        capturedCallback = cb;
        return mockUnsubscribe;
      });

      const listener = jest.fn();
      clientAuth.onAuthStateChanged(listener);

      capturedCallback!(null);

      // listener is called asynchronously via void Promise
      return Promise.resolve().then(() => {
        expect(listener).toHaveBeenCalledWith(null);
      });
    });

    it('wraps the firebase User in an IAuthUser when user is not null', () => {
      const clientAuth = new FirebaseClientAuth(defaultOptions);
      const fakeUser = { uid: 'u1', email: 'a@b.com', getIdToken: jest.fn().mockResolvedValue('tok') };
      let capturedCallback: ((user: unknown) => void) | null = null;
      mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
        capturedCallback = cb;
        return mockUnsubscribe;
      });

      const listener = jest.fn();
      clientAuth.onAuthStateChanged(listener);
      capturedCallback!(fakeUser);

      return Promise.resolve().then(() => {
        expect(listener).toHaveBeenCalledTimes(1);
        const receivedUser = (listener.mock.calls[0] as unknown[])[0] as { uid: string; email: string };
        expect(receivedUser.uid).toBe('u1');
        expect(receivedUser.email).toBe('a@b.com');
      });
    });

    it('returns the unsubscribe function from firebase', () => {
      const clientAuth = new FirebaseClientAuth(defaultOptions);
      const unsub = clientAuth.onAuthStateChanged(jest.fn());
      expect(unsub).toBe(mockUnsubscribe);
    });
  });

  describe('signInWithEmailAndPassword', () => {
    it('delegates to firebase signInWithEmailAndPassword', async () => {
      const clientAuth = new FirebaseClientAuth(defaultOptions);
      await clientAuth.signInWithEmailAndPassword('user@example.com', 'secret');

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledTimes(1);
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'user@example.com',
        'secret',
      );
    });

    it('propagates errors thrown by firebase', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(new Error('Wrong password'));
      const clientAuth = new FirebaseClientAuth(defaultOptions);

      await expect(clientAuth.signInWithEmailAndPassword('a@b.com', 'bad')).rejects.toThrow(
        'Wrong password',
      );
    });
  });

  describe('signInWithGoogle', () => {
    it('creates a GoogleAuthProvider and calls signInWithPopup', async () => {
      const clientAuth = new FirebaseClientAuth(defaultOptions);
      await clientAuth.signInWithGoogle();

      expect(mockSignInWithPopup).toHaveBeenCalledTimes(1);
    });

    it('propagates errors thrown by firebase', async () => {
      mockSignInWithPopup.mockRejectedValueOnce(new Error('Popup closed'));
      const clientAuth = new FirebaseClientAuth(defaultOptions);

      await expect(clientAuth.signInWithGoogle()).rejects.toThrow('Popup closed');
    });
  });

  describe('signOut', () => {
    it('delegates to firebase signOut', async () => {
      const clientAuth = new FirebaseClientAuth(defaultOptions);
      await clientAuth.signOut();

      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('propagates errors thrown by firebase', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('Network error'));
      const clientAuth = new FirebaseClientAuth(defaultOptions);

      await expect(clientAuth.signOut()).rejects.toThrow('Network error');
    });
  });

  describe('getCurrentUser', () => {
    it('returns null when no user is signed in', () => {
      mockGetAuth.mockReturnValue({ currentUser: null });
      const clientAuth = new FirebaseClientAuth(defaultOptions);

      expect(clientAuth.getCurrentUser()).toBeNull();
    });

    it('returns an IAuthUser wrapping the firebase User when signed in', () => {
      const fakeUser = {
        uid: 'u42',
        email: 'test@example.com',
        getIdToken: jest.fn().mockResolvedValue('token-string'),
      };
      mockGetAuth.mockReturnValue({ currentUser: fakeUser });

      const clientAuth = new FirebaseClientAuth(defaultOptions);
      const user = clientAuth.getCurrentUser();

      expect(user).not.toBeNull();
      expect(user!.uid).toBe('u42');
      expect(user!.email).toBe('test@example.com');
    });

    it('IAuthUser.getIdToken delegates to the underlying firebase User', async () => {
      const mockGetIdToken = jest.fn().mockResolvedValue('my-token');
      const fakeUser = { uid: 'u1', email: 'x@y.com', getIdToken: mockGetIdToken };
      mockGetAuth.mockReturnValue({ currentUser: fakeUser });

      const clientAuth = new FirebaseClientAuth(defaultOptions);
      const token = await clientAuth.getCurrentUser()!.getIdToken();

      expect(token).toBe('my-token');
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);
    });
  });
});
