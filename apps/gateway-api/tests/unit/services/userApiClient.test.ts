/**
 * Unit tests for gateway-api userApiClient — covers all exported functions and
 * the centralized error-handler logic (handleUserApiError / STATUS_ERROR_MAP).
 *
 * In particular this suite verifies that a 403 response from the users-api
 * surfaces the ACTUAL message from the response body rather than a hardcoded
 * fallback — the regression scenario is the "last-admin" deletion guard.
 */

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

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
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

import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  RateLimitError,
  UnavailableError,
  DownstreamError,
} from '../../../src/errors.js';
import {
  deleteUserFromApi,
  authorizeUser,
  getUserById,
  listUsersFromApi,
  updateUserInApi,
  listPreApprovedFromApi,
  getPreApprovedFromApi,
  addPreApprovedInApi,
  deletePreApprovedFromApi,
  updatePreApprovedInApi,
} from '../../../src/services/userApiClient.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal AxiosError with a given HTTP status and response body. */
function makeAxiosError(
  status: number,
  body: unknown,
  code?: string,
): Error {
  const err = new Error(`Request failed with status code ${status}`) as Error & {
    isAxiosError: boolean;
    code?: string;
    response: { status: number; data: unknown };
  };
  err.isAxiosError = true;
  err.code = code;
  err.response = { status, data: body };
  Object.defineProperty(err, 'isAxiosError', { value: true });
  return err;
}

/** Creates an AxiosError with no response (network error). */
function makeNetworkError(code?: string): Error {
  const err = new Error('Network Error') as Error & {
    isAxiosError: boolean;
    code?: string;
    response?: undefined;
  };
  err.isAxiosError = true;
  err.code = code;
  err.response = undefined;
  Object.defineProperty(err, 'isAxiosError', { value: true });
  return err;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => jest.clearAllMocks());

// ── deleteUserFromApi ────────────────────────────────────────────────────────

describe('userApiClient — deleteUserFromApi', () => {
  it('resolves on success', async () => {
    mockDelete.mockResolvedValue({});
    await expect(deleteUserFromApi('uid-1')).resolves.toBeUndefined();
  });

  it('throws ForbiddenError with the ACTUAL API message when the users-api returns 403', async () => {
    const lastAdminMessage =
      'You cannot delete this user because they are the only active admin in the system.';
    mockDelete.mockRejectedValueOnce(
      makeAxiosError(403, { error: { message: lastAdminMessage } }),
    );
    const thrown = await deleteUserFromApi('uid-last-admin').catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(ForbiddenError);
    expect((thrown as ForbiddenError).message).toBe(lastAdminMessage);
  });

  it('falls back to the generic forbidden message when the 403 body has no error.message', async () => {
    mockDelete.mockRejectedValueOnce(makeAxiosError(403, {}));
    const thrown = await deleteUserFromApi('uid-no-body').catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(ForbiddenError);
    expect((thrown as ForbiddenError).message).toBe('User cannot be deleted');
  });

  it('throws NotFoundError when the users-api returns 404', async () => {
    mockDelete.mockRejectedValueOnce(makeAxiosError(404, {}));
    await expect(deleteUserFromApi('uid-missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError on 400', async () => {
    mockDelete.mockRejectedValueOnce(makeAxiosError(400, { error: { message: 'bad data' } }));
    await expect(deleteUserFromApi('uid-1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ConflictError on 409', async () => {
    mockDelete.mockRejectedValueOnce(makeAxiosError(409, { error: { message: 'conflict' } }));
    await expect(deleteUserFromApi('uid-1')).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws RateLimitError on 429', async () => {
    mockDelete.mockRejectedValueOnce(makeAxiosError(429, {}));
    await expect(deleteUserFromApi('uid-1')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws UnavailableError on ECONNABORTED', async () => {
    mockDelete.mockRejectedValueOnce(makeNetworkError('ECONNABORTED'));
    await expect(deleteUserFromApi('uid-1')).rejects.toBeInstanceOf(UnavailableError);
  });

  it('throws UnavailableError when no response', async () => {
    mockDelete.mockRejectedValueOnce(makeNetworkError());
    await expect(deleteUserFromApi('uid-1')).rejects.toBeInstanceOf(UnavailableError);
  });

  it('throws UnavailableError on 500', async () => {
    mockDelete.mockRejectedValueOnce(makeAxiosError(500, {}));
    await expect(deleteUserFromApi('uid-1')).rejects.toBeInstanceOf(UnavailableError);
  });

  it('throws DownstreamError on non-axios error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('unexpected'));
    await expect(deleteUserFromApi('uid-1')).rejects.toBeInstanceOf(DownstreamError);
  });
});

// ── authorizeUser ────────────────────────────────────────────────────────────

describe('userApiClient — authorizeUser', () => {
  it('returns role and enable on success', async () => {
    mockPost.mockResolvedValue({
      data: { success: true, data: { role: 'admin', enable: true } },
    });
    const result = await authorizeUser('uid-1', 'user@example.com');
    expect(result).toEqual({ role: 'admin', enable: true });
  });

  it('throws ForbiddenError on 403', async () => {
    mockPost.mockRejectedValueOnce(
      makeAxiosError(403, { error: { message: 'not authorized' } }),
    );
    await expect(authorizeUser('uid-1', 'u@e.com')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws NotFoundError on 404', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosError(404, {}));
    await expect(authorizeUser('uid-1', 'u@e.com')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws UnavailableError on 500', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosError(500, {}));
    await expect(authorizeUser('uid-1', 'u@e.com')).rejects.toBeInstanceOf(UnavailableError);
  });
});

// ── getUserById ──────────────────────────────────────────────────────────────

describe('userApiClient — getUserById', () => {
  it('returns user record on success', async () => {
    const user = { uid: 'uid-1', email: 'u@e.com', role: 'user', enable: true };
    mockGet.mockResolvedValue({ data: { success: true, data: user } });
    const result = await getUserById('uid-1');
    expect(result).toEqual(user);
  });

  it('throws NotFoundError on 404', async () => {
    mockGet.mockRejectedValueOnce(makeAxiosError(404, {}));
    await expect(getUserById('uid-missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws UnavailableError on 503', async () => {
    mockGet.mockRejectedValueOnce(makeAxiosError(503, {}));
    await expect(getUserById('uid-1')).rejects.toBeInstanceOf(UnavailableError);
  });

  it('throws DownstreamError on non-axios error', async () => {
    mockGet.mockRejectedValueOnce(new Error('unexpected'));
    await expect(getUserById('uid-1')).rejects.toBeInstanceOf(DownstreamError);
  });
});

// ── listUsersFromApi ─────────────────────────────────────────────────────────

describe('userApiClient — listUsersFromApi', () => {
  it('returns list response on success (no params)', async () => {
    const listResp = { users: [], nextPageToken: undefined };
    mockGet.mockResolvedValue({ data: { success: true, data: listResp } });
    const result = await listUsersFromApi();
    expect(result).toEqual(listResp);
  });

  it('builds query string with all filters', async () => {
    const listResp = { users: [], nextPageToken: undefined };
    mockGet.mockResolvedValue({ data: { success: true, data: listResp } });
    await listUsersFromApi(50, 'tok123', {
      email: 'u@e.com',
      role: 'admin',
      enable: true,
      orderBy: 'email',
      orderDirection: 'asc',
    });
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('maxResults=50'),
    );
  });

  it('throws UnavailableError on 500', async () => {
    mockGet.mockRejectedValueOnce(makeAxiosError(500, {}));
    await expect(listUsersFromApi()).rejects.toBeInstanceOf(UnavailableError);
  });
});

// ── updateUserInApi ──────────────────────────────────────────────────────────

describe('userApiClient — updateUserInApi', () => {
  it('returns updated user on success', async () => {
    const user = { uid: 'uid-1', email: 'u@e.com', role: 'admin', enable: true };
    mockPatch.mockResolvedValue({ data: { success: true, data: user } });
    const result = await updateUserInApi('uid-1', { role: 'admin' });
    expect(result).toEqual(user);
  });

  it('throws ValidationError on 400', async () => {
    mockPatch.mockRejectedValueOnce(makeAxiosError(400, { error: { message: 'bad data' } }));
    await expect(updateUserInApi('uid-1', { role: 'admin' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError on 404', async () => {
    mockPatch.mockRejectedValueOnce(makeAxiosError(404, {}));
    await expect(updateUserInApi('uid-1', { role: 'admin' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws UnavailableError on ECONNABORTED', async () => {
    mockPatch.mockRejectedValueOnce(makeNetworkError('ECONNABORTED'));
    await expect(updateUserInApi('uid-1', { role: 'admin' })).rejects.toBeInstanceOf(UnavailableError);
  });
});

// ── listPreApprovedFromApi ────────────────────────────────────────────────────

describe('userApiClient — listPreApprovedFromApi', () => {
  it('returns list on success (no filters)', async () => {
    const list = [{ email: 'u@e.com', role: 'admin' }];
    mockGet.mockResolvedValue({ data: { success: true, data: list } });
    const result = await listPreApprovedFromApi();
    expect(result).toEqual(list);
  });

  it('builds query with filters', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: [] } });
    await listPreApprovedFromApi({ role: 'user', orderBy: 'email', orderDirection: 'desc' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('role=user'));
  });

  it('throws UnavailableError on 500', async () => {
    mockGet.mockRejectedValueOnce(makeAxiosError(500, {}));
    await expect(listPreApprovedFromApi()).rejects.toBeInstanceOf(UnavailableError);
  });
});

// ── getPreApprovedFromApi ─────────────────────────────────────────────────────

describe('userApiClient — getPreApprovedFromApi', () => {
  it('returns pre-approved user on success', async () => {
    const pa = { email: 'u@e.com', role: 'admin' };
    mockGet.mockResolvedValue({ data: { success: true, data: pa } });
    const result = await getPreApprovedFromApi('u@e.com');
    expect(result).toEqual(pa);
  });

  it('throws NotFoundError on 404', async () => {
    mockGet.mockRejectedValueOnce(makeAxiosError(404, {}));
    await expect(getPreApprovedFromApi('u@e.com')).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── addPreApprovedInApi ───────────────────────────────────────────────────────

describe('userApiClient — addPreApprovedInApi', () => {
  it('returns created pre-approved user on success', async () => {
    const pa = { email: 'u@e.com', role: 'admin' };
    mockPost.mockResolvedValue({ data: { success: true, data: pa } });
    const result = await addPreApprovedInApi('u@e.com', 'admin');
    expect(result).toEqual(pa);
  });

  it('throws ConflictError on 409', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosError(409, {}));
    await expect(addPreApprovedInApi('u@e.com', 'admin')).rejects.toBeInstanceOf(ConflictError);
  });
});

// ── deletePreApprovedFromApi ──────────────────────────────────────────────────

describe('userApiClient — deletePreApprovedFromApi', () => {
  it('resolves on success', async () => {
    mockDelete.mockResolvedValue({});
    await expect(deletePreApprovedFromApi('u@e.com')).resolves.toBeUndefined();
  });

  it('throws NotFoundError on 404', async () => {
    mockDelete.mockRejectedValueOnce(makeAxiosError(404, {}));
    await expect(deletePreApprovedFromApi('u@e.com')).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── updatePreApprovedInApi ────────────────────────────────────────────────────

describe('userApiClient — updatePreApprovedInApi', () => {
  it('returns updated pre-approved user on success', async () => {
    const pa = { email: 'u@e.com', role: 'user' };
    mockPatch.mockResolvedValue({ data: { success: true, data: pa } });
    const result = await updatePreApprovedInApi('u@e.com', { role: 'user' });
    expect(result).toEqual(pa);
  });

  it('throws ValidationError on 400', async () => {
    mockPatch.mockRejectedValueOnce(makeAxiosError(400, {}));
    await expect(updatePreApprovedInApi('u@e.com', { role: 'user' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError on 404', async () => {
    mockPatch.mockRejectedValueOnce(makeAxiosError(404, {}));
    await expect(updatePreApprovedInApi('u@e.com', { role: 'user' })).rejects.toBeInstanceOf(NotFoundError);
  });
});
