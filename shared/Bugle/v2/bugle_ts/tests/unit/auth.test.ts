/**
 * Unit tests for getGoogleAuthClient (v2 — ADC-based).
 *
 * The `google-auth-library` module is fully mocked so no real Google credentials are needed.
 */

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation((opts: unknown) => ({ _opts: opts })),
}));

import { GoogleAuth } from 'google-auth-library';
import { getGoogleAuthClient, DRIVE_READONLY_SCOPES } from '../../src/auth.js';

describe('getGoogleAuthClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a GoogleAuth client with default Drive scopes using ADC', () => {
    const auth = getGoogleAuthClient();

    expect(GoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: expect.arrayContaining([...DRIVE_READONLY_SCOPES]),
      }),
    );
    expect(auth).toBeDefined();
  });

  it('does not pass explicit credentials when none are provided (ADC)', () => {
    getGoogleAuthClient();

    const callArg = (GoogleAuth as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty('credentials');
  });

  it('accepts custom scopes', () => {
    const customScopes = ['https://www.googleapis.com/auth/spreadsheets'];

    getGoogleAuthClient(customScopes);

    expect(GoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({ scopes: customScopes }),
    );
  });

  it('passes explicit credentials when provided by caller', () => {
    const mockCreds = {
      type: 'service_account',
      client_email: 'svc@test-project.iam.gserviceaccount.com',
      private_key: '-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----\n',
    };

    getGoogleAuthClient(DRIVE_READONLY_SCOPES, mockCreds);

    expect(GoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({ credentials: mockCreds }),
    );
  });
});
