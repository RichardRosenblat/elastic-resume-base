/**
 * Unit tests for initializePersistence.
 *
 * Firebase Admin is fully mocked so no real Firebase project or emulator is
 * needed.
 */

// ── Mocks (must be declared before any imports that trigger module initialisation) ──

jest.mock('firebase-admin', () => ({
  apps: [] as unknown[],
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn().mockReturnValue({ mockCert: true }),
  },
}));

// ── Imports (after mock declarations) ──

import admin from 'firebase-admin';
import { initializePersistence } from '../../src/persistence.js';

// ── Helpers ──

/** Casts the firebase-admin mock to a mutable shape for test setup. */
function getAdminMock() {
  return admin as unknown as {
    apps: unknown[];
    initializeApp: jest.Mock;
    credential: { cert: jest.Mock };
  };
}

// ── Tests ──

describe('initializePersistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAdminMock().apps.length = 0; // reset app registry between tests
  });

  it('calls admin.initializeApp with the provided projectId', () => {
    const mock = getAdminMock();

    initializePersistence({ projectId: 'test-project' });

    expect(mock.initializeApp).toHaveBeenCalledTimes(1);
    expect(mock.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'test-project' }),
    );
  });

  it('is idempotent: skips initializeApp when already initialised', () => {
    const mock = getAdminMock();
    mock.apps.push({ name: '[DEFAULT]' }); // simulate an already-initialised app

    initializePersistence({ projectId: 'test-project' });

    expect(mock.initializeApp).not.toHaveBeenCalled();
  });

  it('sets credential when a raw JSON serviceAccountKey is supplied', () => {
    const mock = getAdminMock();
    const key = JSON.stringify({ type: 'service_account', project_id: 'test' });

    initializePersistence({ projectId: 'test-project', serviceAccountKey: key });

    expect(mock.credential.cert).toHaveBeenCalledTimes(1);
    expect(mock.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ credential: { mockCert: true } }),
    );
  });

  it('sets credential when a Base64-encoded serviceAccountKey is supplied', () => {
    const mock = getAdminMock();
    const raw = JSON.stringify({ type: 'service_account', project_id: 'test' });
    const b64 = Buffer.from(raw).toString('base64');

    initializePersistence({ projectId: 'test-project', serviceAccountKey: b64 });

    expect(mock.credential.cert).toHaveBeenCalledTimes(1);
    expect(mock.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ credential: { mockCert: true } }),
    );
  });

  it('falls back to default credentials when serviceAccountKey is invalid JSON', () => {
    const mock = getAdminMock();

    initializePersistence({ projectId: 'test-project', serviceAccountKey: 'not-valid-json' });

    // credential.cert should NOT have been called — fallback to ADC
    expect(mock.credential.cert).not.toHaveBeenCalled();
    // initializeApp should still be called (without credential)
    expect(mock.initializeApp).toHaveBeenCalledTimes(1);
    expect(mock.initializeApp).toHaveBeenCalledWith(
      expect.not.objectContaining({ credential: expect.anything() }),
    );
  });

  it('initialises without credential when no serviceAccountKey is provided', () => {
    const mock = getAdminMock();

    initializePersistence({ projectId: 'demo-project' });

    expect(mock.credential.cert).not.toHaveBeenCalled();
    expect(mock.initializeApp).toHaveBeenCalledWith({ projectId: 'demo-project' });
  });
});
