/**
 * Unit tests for getGoogleAuthClient.
 *
 * The `google-auth-library` module is fully mocked so no real Google credentials are needed.
 */

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation((opts: unknown) => ({ _opts: opts })),
}));

import { GoogleAuth } from 'google-auth-library';
import { getGoogleAuthClient, DRIVE_READONLY_SCOPES } from '../../src/auth.js';

const MOCK_CREDENTIALS = {
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'key-id',
  private_key: '-----BEGIN RSA PRIVATE KEY-----\nMOCK\n-----END RSA PRIVATE KEY-----\n',
  client_email: 'svc@test-project.iam.gserviceaccount.com',
  client_id: '123456789',
};

describe('getGoogleAuthClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['GOOGLE_SERVICE_ACCOUNT_KEY'];
  });

  it('creates a GoogleAuth client with default Drive scopes', () => {
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY'] = JSON.stringify(MOCK_CREDENTIALS);

    const auth = getGoogleAuthClient();

    expect(GoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: MOCK_CREDENTIALS,
        scopes: expect.arrayContaining([...DRIVE_READONLY_SCOPES]),
      }),
    );
    expect(auth).toBeDefined();
  });

  it('accepts custom scopes', () => {
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY'] = JSON.stringify(MOCK_CREDENTIALS);
    const customScopes = ['https://www.googleapis.com/auth/spreadsheets'];

    getGoogleAuthClient(customScopes);

    expect(GoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({ scopes: customScopes }),
    );
  });

  it('accepts a Base64-encoded JSON service account key', () => {
    const encoded = Buffer.from(JSON.stringify(MOCK_CREDENTIALS)).toString('base64');
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY'] = encoded;

    const auth = getGoogleAuthClient();

    expect(GoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({ credentials: MOCK_CREDENTIALS }),
    );
    expect(auth).toBeDefined();
  });

  it('throws when GOOGLE_SERVICE_ACCOUNT_KEY is missing', () => {
    delete process.env['GOOGLE_SERVICE_ACCOUNT_KEY'];

    expect(() => getGoogleAuthClient()).toThrow();
  });

  it('throws when the key value is not valid JSON', () => {
    process.env['GOOGLE_SERVICE_ACCOUNT_KEY'] = 'not-valid-json';

    expect(() => getGoogleAuthClient()).toThrow(/parse/i);
  });
});
