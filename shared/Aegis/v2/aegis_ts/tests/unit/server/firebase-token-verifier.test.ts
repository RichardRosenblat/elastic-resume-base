/**
 * Unit tests for FirebaseTokenVerifier.
 *
 * Firebase Admin is fully mocked so no real Firebase project or emulator is
 * needed.
 */

// ── Mocks (must be declared before any imports that trigger module initialisation) ──

jest.mock('firebase-admin', () => ({
  apps: [] as unknown[],
  initializeApp: jest.fn().mockReturnValue({ name: '[DEFAULT]' }),
  credential: {
    cert: jest.fn().mockReturnValue({ mockCert: true }),
  },
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn(),
  }),
}));

// ── Imports (after mock declarations) ──

import admin from 'firebase-admin';
import { FirebaseTokenVerifier } from '../../../src/server/firebase-token-verifier.js';

// ── Helpers ──

/** Casts the firebase-admin mock to a mutable shape for test setup. */
function getAdminMock() {
  return admin as unknown as {
    apps: unknown[];
    initializeApp: jest.Mock;
    credential: { cert: jest.Mock };
    auth: jest.Mock;
  };
}

// ── Tests ──

describe('FirebaseTokenVerifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAdminMock().apps.length = 0;
    // Restore default auth mock after each clear
    getAdminMock().auth.mockReturnValue({ verifyIdToken: jest.fn() });
  });

  describe('constructor', () => {
    it('calls admin.initializeApp with the provided projectId', () => {
      const mock = getAdminMock();

      new FirebaseTokenVerifier({ projectId: 'test-project' });

      expect(mock.initializeApp).toHaveBeenCalledTimes(1);
      expect(mock.initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'test-project' }),
      );
    });

    it('reuses an already-initialised Firebase app (idempotent)', () => {
      const mock = getAdminMock();
      const existingApp = { name: '[DEFAULT]' };
      mock.apps.push(existingApp);

      new FirebaseTokenVerifier({ projectId: 'test-project' });

      expect(mock.initializeApp).not.toHaveBeenCalled();
    });

    it('sets credential when a raw JSON serviceAccountKey is supplied', () => {
      const mock = getAdminMock();
      const key = JSON.stringify({ type: 'service_account', project_id: 'test' });

      new FirebaseTokenVerifier({ projectId: 'test-project', serviceAccountKey: key });

      expect(mock.credential.cert).toHaveBeenCalledTimes(1);
      expect(mock.initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({ credential: { mockCert: true } }),
      );
    });

    it('sets credential when a Base64-encoded serviceAccountKey is supplied', () => {
      const mock = getAdminMock();
      const raw = JSON.stringify({ type: 'service_account', project_id: 'test' });
      const b64 = Buffer.from(raw).toString('base64');

      new FirebaseTokenVerifier({ projectId: 'test-project', serviceAccountKey: b64 });

      expect(mock.credential.cert).toHaveBeenCalledTimes(1);
      expect(mock.initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({ credential: { mockCert: true } }),
      );
    });

    it('falls back to default credentials when serviceAccountKey is invalid JSON', () => {
      const mock = getAdminMock();

      new FirebaseTokenVerifier({ projectId: 'test-project', serviceAccountKey: 'not-valid-json' });

      expect(mock.credential.cert).not.toHaveBeenCalled();
      expect(mock.initializeApp).toHaveBeenCalledWith(
        expect.not.objectContaining({ credential: expect.anything() }),
      );
    });
  });

  describe('verifyToken', () => {
    it('returns decoded token data when verification succeeds', async () => {
      const mock = getAdminMock();
      const decodedFirebaseToken = {
        uid: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
      };
      mock.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockResolvedValue(decodedFirebaseToken),
      });

      const verifier = new FirebaseTokenVerifier({ projectId: 'test-project' });
      const result = await verifier.verifyToken('valid-token');

      expect(result).toEqual({
        uid: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
      });
    });

    it('returns decoded token with undefined optional fields when absent', async () => {
      const mock = getAdminMock();
      const decodedFirebaseToken = { uid: 'user-456' };
      mock.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockResolvedValue(decodedFirebaseToken),
      });

      const verifier = new FirebaseTokenVerifier({ projectId: 'test-project' });
      const result = await verifier.verifyToken('valid-token');

      expect(result.uid).toBe('user-456');
      expect(result.email).toBeUndefined();
      expect(result.name).toBeUndefined();
      expect(result.picture).toBeUndefined();
    });

    it('propagates error when token verification fails', async () => {
      const mock = getAdminMock();
      mock.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockRejectedValue(new Error('Token expired')),
      });

      const verifier = new FirebaseTokenVerifier({ projectId: 'test-project' });

      await expect(verifier.verifyToken('expired-token')).rejects.toThrow('Token expired');
    });

    it('calls admin.auth with the initialized app', async () => {
      const mock = getAdminMock();
      const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: 'user-789' });
      mock.auth.mockReturnValue({ verifyIdToken: mockVerifyIdToken });

      const verifier = new FirebaseTokenVerifier({ projectId: 'test-project' });
      await verifier.verifyToken('some-token');

      expect(mock.auth).toHaveBeenCalledTimes(1);
      expect(mockVerifyIdToken).toHaveBeenCalledWith('some-token');
    });
  });
});
