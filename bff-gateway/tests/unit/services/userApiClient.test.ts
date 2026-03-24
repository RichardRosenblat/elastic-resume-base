/**
 * Unit tests for bff-gateway userApiClient — focusing on the centralized
 * error-handler logic (handleUserApiError / STATUS_ERROR_MAP).
 *
 * In particular this suite verifies that a 403 response from the users-api
 * surfaces the ACTUAL message from the response body rather than a hardcoded
 * fallback — the regression scenario is the "last-admin" deletion guard.
 */

import axios from 'axios';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before any `import … from` that touches the module
// under test.
// ---------------------------------------------------------------------------

jest.mock('../../../src/config', () => ({
  config: {
    userApiServiceUrl: 'http://localhost:8005',
    requestTimeoutMs: 30000,
    nodeEnv: 'test',
  },
}));

// Stub the HTTP client so we can simulate any response without a real network.
const mockDelete = jest.fn();
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockPatch = jest.fn();

jest.mock('../../../src/utils/httpClient', () => ({
  createHttpClient: () => ({
    delete: mockDelete,
    post: mockPost,
    get: mockGet,
    patch: mockPatch,
  }),
}));

import { ForbiddenError, NotFoundError } from '../../../src/errors.js';
import { deleteUserFromApi } from '../../../src/services/userApiClient.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal AxiosError with a given HTTP status and response body. */
function makeAxiosError(status: number, body: unknown): Error {
  const err = new Error(`Request failed with status code ${status}`) as Error & {
    isAxiosError: boolean;
    response: { status: number; data: unknown };
  };
  (err as { isAxiosError: boolean }).isAxiosError = true;
  (err as { response: { status: number; data: unknown } }).response = { status, data: body };
  // Ensure axios.isAxiosError() returns true
  Object.defineProperty(err, 'isAxiosError', { value: true });
  return err;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('userApiClient — deleteUserFromApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws ForbiddenError with the ACTUAL API message when the users-api returns 403', async () => {
    const lastAdminMessage =
      'You cannot delete this user because they are the only active admin in the system. Please assign another user as admin before deleting this user.';

    mockDelete.mockRejectedValueOnce(
      makeAxiosError(403, { error: { message: lastAdminMessage } }),
    );

    let thrown: unknown;
    try {
      await deleteUserFromApi('uid-last-admin');
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ForbiddenError);
    expect((thrown as ForbiddenError).message).toBe(lastAdminMessage);
  });

  it('falls back to the generic forbidden message when the 403 body has no error.message', async () => {
    mockDelete.mockRejectedValueOnce(makeAxiosError(403, {}));

    let thrown: unknown;
    try {
      await deleteUserFromApi('uid-no-body');
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ForbiddenError);
    expect((thrown as ForbiddenError).message).toBe('User cannot be deleted');
  });

  it('throws NotFoundError when the users-api returns 404', async () => {
    mockDelete.mockRejectedValueOnce(
      makeAxiosError(404, { error: { message: 'not found' } }),
    );

    await expect(deleteUserFromApi('uid-missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
