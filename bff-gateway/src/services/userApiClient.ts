import axios from 'axios';
import { config } from '../config.js';
import { DownstreamError, ForbiddenError, UnavailableError } from '../errors.js';
import { createHttpClient } from '../utils/httpClient.js';
import { logger } from '../utils/logger.js';
import type { PreApprovedUser, UserRecord, ListUsersResponse, UpdateUserRequest, UpdatePreApprovedRequest } from '../models/index.js';

const client = createHttpClient(config.userApiServiceUrl);

type ErrorHandlerParams = {
  context: Record<string, unknown>;
  operationName: string;
  forbiddenMsg: string;
};

/** Dispatch table: HTTP status code → error factory. */
const STATUS_ERROR_MAP: Partial<Record<number, (params: ErrorHandlerParams) => never>> = {
  403: ({ context, operationName, forbiddenMsg }) => {
    logger.info(context, `${operationName}: UserAPI returned 403 Forbidden`);
    throw new ForbiddenError(forbiddenMsg);
  },
  404: ({ context, operationName, forbiddenMsg }) => {
    logger.info(context, `${operationName}: resource not found (404)`);
    throw new ForbiddenError(forbiddenMsg);
  },
};

/**
 * Centralized error handler for UserAPI requests in this file.
 * @throws {ForbiddenError} If the UserAPI returns HTTP 403 or 404.
 * @throws {UnavailableError} If the UserAPI returns 5xx, times out, or is unreachable.
 * @throws {DownstreamError} For any other unexpected errors.
 */
function handleUserApiError(
  err: unknown,
  params: ErrorHandlerParams & { unavailableActionMsg: string },
): never {
  const { context, operationName } = params;
  if (axios.isAxiosError(err)) {
    logger.debug(
      { ...context, status: err?.response?.status, data: err?.response?.data as unknown },
      `${operationName}: UserAPI response details`,
    );

    const status = err.response?.status;
    const handler = status !== undefined ? STATUS_ERROR_MAP[status] : undefined;
    if (handler) {
      handler(params);
    }

    if (err.code === 'ECONNABORTED') {
      logger.error(context, `${operationName}: UserAPI timeout`);
      throw new UnavailableError('UserAPI timeout');
    }

    if (!err.response) {
      logger.error({ ...context, err }, `${operationName}: UserAPI unreachable`);
      throw new UnavailableError('UserAPI unreachable');
    }

    if (err.response.status >= 500) {
      logger.error(
        { ...context, status: err.response.status },
        `${operationName}: UserAPI internal error`,
      );
      throw new UnavailableError('UserAPI failure');
    }
  }

  logger.error(
    { ...context, err },
    `${operationName}: UserAPI response invalid or unexpected error`,
  );
  throw new DownstreamError('UserAPI returned an invalid response format');
}

// ---------------------------------------------------------------------------
// Authorization (called during login flow)
// ---------------------------------------------------------------------------

/**
 * Calls the users-api authorize endpoint to determine if a user is authorized
 * and to obtain their role and enable status.
 *
 * @param uid - Firebase user UID from the authentication token.
 * @param email - Firebase user email from the authentication token.
 * @returns The user's role and enable status.
 * @throws {ForbiddenError} If the user is not authorized.
 * @throws {UnavailableError} If the UserAPI is unavailable.
 * @throws {DownstreamError} If the UserAPI returns an unexpected response.
 */
export async function authorizeUser(uid: string, email: string): Promise<{ role: string; enable: boolean }> {
  logger.debug({ uid, email }, 'authorizeUser: calling UserAPI authorize endpoint');
  try {
    const response = await client.post<{ success: boolean; data: { role: string; enable: boolean } }>(
      '/api/v1/users/authorize',
      { uid, email },
    );
    const { role, enable } = response.data.data;
    logger.debug({ uid, role, enable }, 'authorizeUser: authorization result received');
    return { role, enable };
  } catch (err) {
    handleUserApiError(err, {
      context: { uid, email },
      operationName: 'authorizeUser',
      forbiddenMsg: 'User does not have access to this application',
      unavailableActionMsg: 'authorize user',
    });
  }
}

// ---------------------------------------------------------------------------
// User management (proxied from BFF to users-api)
// ---------------------------------------------------------------------------

/**
 * Retrieves a single user by UID from the users-api.
 */
export async function getUserById(uid: string): Promise<UserRecord> {
  logger.debug({ uid }, 'getUserById: requesting user from UserAPI');
  try {
    const response = await client.get<{ success: boolean; data: UserRecord }>(
      `/api/v1/users/${encodeURIComponent(uid)}`,
    );
    return response.data.data;
  } catch (err) {
    handleUserApiError(err, {
      context: { uid },
      operationName: 'getUserById',
      forbiddenMsg: 'User not found',
      unavailableActionMsg: 'retrieve user',
    });
  }
}

/**
 * Retrieves a paginated list of users from the users-api.
 */
export async function listUsersFromApi(maxResults?: number, pageToken?: string, filters?: { role?: string; enable?: boolean }): Promise<ListUsersResponse> {
  logger.debug({ maxResults, pageToken, filters }, 'listUsersFromApi: requesting user list from UserAPI');
  try {
    const params = new URLSearchParams();
    if (maxResults !== undefined) params.set('maxResults', String(maxResults));
    if (pageToken) params.set('pageToken', pageToken);
    if (filters?.role !== undefined) params.set('role', filters.role);
    if (filters?.enable !== undefined) params.set('enable', String(filters.enable));
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await client.get<{ success: boolean; data: ListUsersResponse }>(
      `/api/v1/users${query}`,
    );
    return response.data.data;
  } catch (err) {
    handleUserApiError(err, {
      context: { maxResults, pageToken },
      operationName: 'listUsersFromApi',
      forbiddenMsg: 'Could not list users',
      unavailableActionMsg: 'list users',
    });
  }
}

/**
 * Updates a user in the users-api.
 */
export async function updateUserInApi(uid: string, data: UpdateUserRequest): Promise<UserRecord> {
  logger.debug({ uid }, 'updateUserInApi: updating user in UserAPI');
  try {
    const response = await client.patch<{ success: boolean; data: UserRecord }>(
      `/api/v1/users/${encodeURIComponent(uid)}`,
      data,
    );
    return response.data.data;
  } catch (err) {
    handleUserApiError(err, {
      context: { uid },
      operationName: 'updateUserInApi',
      forbiddenMsg: 'User not found',
      unavailableActionMsg: 'update user',
    });
  }
}

/**
 * Deletes a user from the users-api.
 */
export async function deleteUserFromApi(uid: string): Promise<void> {
  logger.debug({ uid }, 'deleteUserFromApi: deleting user from UserAPI');
  try {
    await client.delete(`/api/v1/users/${encodeURIComponent(uid)}`);
  } catch (err) {
    handleUserApiError(err, {
      context: { uid },
      operationName: 'deleteUserFromApi',
      forbiddenMsg: 'User not found',
      unavailableActionMsg: 'delete user',
    });
  }
}

// ---------------------------------------------------------------------------
// Pre-approve management
// ---------------------------------------------------------------------------

/**
 * Lists all pre-approved users from the users-api.
 */
export async function listPreApprovedFromApi(filters?: { role?: string }): Promise<PreApprovedUser[]> {
  logger.debug({ filters }, 'listPreApprovedFromApi: requesting pre-approved users from UserAPI');
  try {
    const params = new URLSearchParams();
    if (filters?.role !== undefined) params.set('role', filters.role);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await client.get<{ success: boolean; data: PreApprovedUser[] }>(
      `/api/v1/users/pre-approve${query}`,
    );
    return response.data.data;
  } catch (err) {
    handleUserApiError(err, {
      context: {},
      operationName: 'listPreApprovedFromApi',
      forbiddenMsg: 'Could not list pre-approved users',
      unavailableActionMsg: 'list pre-approved users',
    });
  }
}

/**
 * Gets a specific pre-approved user by email from the users-api.
 */
export async function getPreApprovedFromApi(email: string): Promise<PreApprovedUser> {
  logger.debug({ email }, 'getPreApprovedFromApi: requesting pre-approved user from UserAPI');
  try {
    const response = await client.get<{ success: boolean; data: PreApprovedUser }>(
      `/api/v1/users/pre-approve?email=${encodeURIComponent(email)}`,
    );
    return response.data.data;
  } catch (err) {
    handleUserApiError(err, {
      context: { email },
      operationName: 'getPreApprovedFromApi',
      forbiddenMsg: 'Pre-approved user not found',
      unavailableActionMsg: 'get pre-approved user',
    });
  }
}

/**
 * Adds a user to the pre-approved list in the users-api.
 */
export async function addPreApprovedInApi(email: string, role: string): Promise<PreApprovedUser> {
  logger.debug({ email, role }, 'addPreApprovedInApi: adding pre-approved user in UserAPI');
  try {
    const response = await client.post<{ success: boolean; data: PreApprovedUser }>(
      '/api/v1/users/pre-approve',
      { email, role },
    );
    return response.data.data;
  } catch (err) {
    handleUserApiError(err, {
      context: { email },
      operationName: 'addPreApprovedInApi',
      forbiddenMsg: 'Could not add pre-approved user',
      unavailableActionMsg: 'add pre-approved user',
    });
  }
}

/**
 * Deletes a pre-approved user by email from the users-api.
 */
export async function deletePreApprovedFromApi(email: string): Promise<void> {
  logger.debug({ email }, 'deletePreApprovedFromApi: deleting pre-approved user from UserAPI');
  try {
    await client.delete(`/api/v1/users/pre-approve?email=${encodeURIComponent(email)}`);
  } catch (err) {
    handleUserApiError(err, {
      context: { email },
      operationName: 'deletePreApprovedFromApi',
      forbiddenMsg: 'Pre-approved user not found',
      unavailableActionMsg: 'delete pre-approved user',
    });
  }
}

/**
 * Updates a pre-approved user in the users-api.
 */
export async function updatePreApprovedInApi(email: string, data: UpdatePreApprovedRequest): Promise<PreApprovedUser> {
  logger.debug({ email }, 'updatePreApprovedInApi: updating pre-approved user in UserAPI');
  try {
    const response = await client.patch<{ success: boolean; data: PreApprovedUser }>(
      `/api/v1/users/pre-approve?email=${encodeURIComponent(email)}`,
      data,
    );
    return response.data.data;
  } catch (err) {
    handleUserApiError(err, {
      context: { email },
      operationName: 'updatePreApprovedInApi',
      forbiddenMsg: 'Pre-approved user not found',
      unavailableActionMsg: 'update pre-approved user',
    });
  }
}


