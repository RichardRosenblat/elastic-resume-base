import axios from 'axios';
import { config } from '../config.js';
import { ConflictError, DownstreamError, ForbiddenError, NotFoundError, UnavailableError } from '../errors.js';
import { createHttpClient } from '../utils/httpClient.js';
import { logger } from '../utils/logger.js';

const client = createHttpClient(config.userApiServiceUrl);

/**
 * Centralized error handler for UserAPI requests in this file.
 * Recasts errors to prevent leaking user data and maps Axios errors to internal application errors.
 * @param err - The original error thrown by the Axios request.
 * @param options.context - Additional context to include in logs (e.g. request parameters).
 * @param options.operationName - Name of the calling operation for logging purposes.
 * @param options.forbiddenMsg - Custom message to use for ForbiddenError when UserAPI returns 404.
 * @param options.unavailableActionMsg - Description of the attempted action for UnavailableError messages.
 * @throws {ForbiddenError} If the UserAPI returns HTTP 404 (recast to avoid leaking user existence).
 * @throws {UnavailableError} If the UserAPI returns HTTP 403, 5xx, times out, or is unreachable.
 * @throws {DownstreamError} For any other unexpected errors from the UserAPI.
 */
function handleUserApiError(
  err: unknown,
  {
    context,
    operationName,
    forbiddenMsg,
    unavailableActionMsg,
  }: {
    context: Record<string, unknown>;
    operationName: string;
    forbiddenMsg: string;
    unavailableActionMsg: string;
  },
): never {
  if (axios.isAxiosError(err)) {
    logger.debug(
      { ...context, status: err?.response?.status, data: err?.response?.data as unknown },
      `${operationName}: UserAPI response details`,
    );
    if (err.response?.status === 404) {
      logger.info(
        context,
        `${operationName}: user(s) not found in UserAPI (404) recasting to ForbiddenError`,
      );
      throw new ForbiddenError(forbiddenMsg);
    }

    if (err.response?.status === 403) {
      logger.info(context, `${operationName}: UserAPI denied access (403)`);
      throw new UnavailableError(
        `UserAPI is currently unavailable; cannot ${unavailableActionMsg}`,
      );
    }

    if (err.code === 'ECONNABORTED') {
      logger.error(context, `${operationName}: UserAPI timeout`);
      throw new UnavailableError('UserAPI timeout');
    }

    if (!err.response) {
      logger.error({ ...context, err }, `${operationName}: UserAPI unreachable`);
      throw new UnavailableError('UserAPI unreachable');
    }

    if (err.response?.status >= 500) {
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

/**
 * Retrieves the role of a single user from the UserAPI service.
 *
 * @param email - Firebase user email address.
 * @returns The user's role string (e.g. `'admin'` or `'user'`).
 * @throws {ForbiddenError} If the UserAPI returns HTTP 404 (recast to avoid leaking user existence).
 * @throws {UnavailableError} If the UserAPI returns HTTP 403, 5xx, times out, or is unreachable.
 * @throws {DownstreamError} If the UserAPI returns an unexpected response or any other error occurs during the request.
 */
export async function getUserRoleByEmail(email: string): Promise<string> {
  logger.debug({ email }, 'getUserRoleByEmail: requesting role from UserAPI');
  try {
    const response = await client.get<{ success: boolean; data: { role: string } }>(
      `/api/v1/users/role?email=${encodeURIComponent(email)}`,
    );
    const role = response.data.data.role;
    logger.debug({ email, role }, 'getUserRoleByEmail: role retrieved from UserAPI');
    return role;
  } catch (err) {
    handleUserApiError(err, {
      context: { email },
      operationName: 'getUserRoleByEmail',
      forbiddenMsg: 'User does not have access to this application',
      unavailableActionMsg: 'retrieve user role',
    });
  }
}

/**
 * Retrieves roles for multiple users from the UserAPI service in a single batch request.
 *
 * @param uids - Array of Firebase user UIDs.
 * @returns A map of `uid → role` for every provided UID.
 * @throws {ForbiddenError} If the UserAPI returns HTTP 404 (recast to avoid leaking user existence).
 * @throws {UnavailableError} If the UserAPI returns HTTP 403, 5xx, times out, or is unreachable.
 * @throws {DownstreamError} If the UserAPI returns an unexpected response or any other error occurs during the request.
 */
export async function getUserRolesBatch(uids: string[]): Promise<Record<string, string>> {
  logger.debug({ count: uids.length }, 'getUserRolesBatch: requesting batch roles from UserAPI');
  try {
    const response = await client.post<{ success: boolean; data: Record<string, string> }>(
      '/api/v1/users/roles/batch',
      { uids },
    );
    logger.debug({ count: uids.length }, 'getUserRolesBatch: batch roles retrieved from UserAPI');
    return response.data.data;
  } catch (err) {
    handleUserApiError(err, {
      context: { uids },
      operationName: 'getUserRolesBatch',
      forbiddenMsg: 'One or more users do not have access to this application',
      unavailableActionMsg: 'retrieve user roles',
    });
  }
}

/**
 * Validates that the given user has access to this application by calling the UserAPI.
 *
 * @param email - Firebase user email address.
 * @returns The user's role string if access is granted.
 * @throws {ForbiddenError} If the UserAPI returns HTTP 404 (recast to avoid leaking user existence).
 * @throws {UnavailableError} If the UserAPI returns HTTP 403, 5xx, times out, or is unreachable.
 * @throws {DownstreamError} If the UserAPI returns an unexpected response or any other error occurs during the request.
 */
export async function checkUserAccess(email: string): Promise<string> {
  logger.debug({ email }, 'checkUserAccess: verifying application access via UserAPI');
  try {
    const response = await client.get<{ success: boolean; data: { role: string } }>(
      `/api/v1/users/role?email=${encodeURIComponent(email)}`,
    );
    const role = response.data.data.role;
    logger.debug({ email, role }, 'checkUserAccess: access granted');
    return role;
  } catch (err) {
    handleUserApiError(err, {
      context: { email },
      operationName: 'checkUserAccess',
      forbiddenMsg: 'User does not have access to this application',
      unavailableActionMsg: 'verify user access',
    });
  }
}

/** Shape of a user record returned by the Users API. */
export interface UsersApiUserRecord {
  uid: string;
  email: string;
  role: string;
  enabled: boolean;
  disabled: boolean;
  displayName?: string;
  photoURL?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Shape of an allowlist entry returned by the Users API. */
export interface UsersApiAllowlistEntry {
  email: string;
  role?: string;
}

/**
 * Retrieves a user record from the Users API by Firebase UID.
 *
 * @param uid - Firebase user UID.
 * @returns The {@link UsersApiUserRecord} if found.
 * @throws {NotFoundError} If the user does not exist (HTTP 404).
 * @throws {UnavailableError} If the UserAPI is unreachable or returns a 5xx error.
 * @throws {DownstreamError} If the UserAPI returns an unexpected response.
 */
export async function getUserById(uid: string): Promise<UsersApiUserRecord> {
  logger.debug({ uid }, 'getUserById: fetching user from UserAPI');
  try {
    const response = await client.get<{ success: boolean; data: UsersApiUserRecord }>(
      `/api/v1/users/${encodeURIComponent(uid)}`,
    );
    logger.debug({ uid }, 'getUserById: user retrieved from UserAPI');
    return response.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      throw new NotFoundError(`User '${uid}' not found`);
    }
    handleUserApiError(err, {
      context: { uid },
      operationName: 'getUserById',
      forbiddenMsg: 'User not found',
      unavailableActionMsg: 'retrieve user',
    });
  }
}

/**
 * Creates a new user in the Users API (Firestore).
 *
 * This call is idempotent by uid: if a user with the same uid already exists,
 * the existing record is returned.
 *
 * @param payload - User creation data including uid, email, role, and enabled flag.
 * @returns The created (or existing) {@link UsersApiUserRecord}.
 * @throws {UnavailableError} If the UserAPI is unreachable or returns a 5xx error.
 * @throws {DownstreamError} If the UserAPI returns an unexpected response.
 */
export async function createUserInUsersApi(payload: {
  uid: string;
  email: string;
  role?: string;
  enabled?: boolean;
}): Promise<UsersApiUserRecord> {
  logger.debug({ uid: payload.uid, email: payload.email }, 'createUserInUsersApi: creating user in UserAPI');
  try {
    const response = await client.post<{ success: boolean; data: UsersApiUserRecord }>(
      '/api/v1/users',
      payload,
    );
    logger.debug({ uid: payload.uid }, 'createUserInUsersApi: user created in UserAPI');
    return response.data.data;
  } catch (err) {
    // Handle idempotency: if the user already exists (409), fetch and return them
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      logger.info({ uid: payload.uid }, 'createUserInUsersApi: conflict – fetching existing user');
      return getUserById(payload.uid);
    }
    handleUserApiError(err, {
      context: { uid: payload.uid, email: payload.email },
      operationName: 'createUserInUsersApi',
      forbiddenMsg: 'Unable to create user',
      unavailableActionMsg: 'create user',
    });
  }
}

/**
 * Retrieves an allowlist entry from the Users API by email address.
 *
 * @param email - Email address to look up.
 * @returns The {@link UsersApiAllowlistEntry} if found.
 * @throws {NotFoundError} If no allowlist entry exists for the given email.
 * @throws {UnavailableError} If the UserAPI is unreachable or returns a 5xx error.
 * @throws {DownstreamError} If the UserAPI returns an unexpected response.
 */
export async function getAllowlistEntry(email: string): Promise<UsersApiAllowlistEntry> {
  logger.debug({ email }, 'getAllowlistEntry: checking allowlist via UserAPI');
  try {
    const response = await client.get<{ success: boolean; data: UsersApiAllowlistEntry }>(
      `/api/v1/allowlist/${encodeURIComponent(email.toLowerCase())}`,
    );
    logger.debug({ email }, 'getAllowlistEntry: entry found');
    return response.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      throw new NotFoundError(`No allowlist entry for '${email}'`);
    }
    handleUserApiError(err, {
      context: { email },
      operationName: 'getAllowlistEntry',
      forbiddenMsg: 'Allowlist entry not found',
      unavailableActionMsg: 'check allowlist',
    });
  }
}

/**
 * Removes an allowlist entry from the Users API.
 *
 * @param email - Email address to remove from the allowlist.
 * @throws {UnavailableError} If the UserAPI is unreachable or returns a 5xx error.
 * @throws {DownstreamError} If the UserAPI returns an unexpected response.
 */
export async function deleteAllowlistEntry(email: string): Promise<void> {
  logger.debug({ email }, 'deleteAllowlistEntry: removing allowlist entry via UserAPI');
  try {
    await client.delete(`/api/v1/allowlist/${encodeURIComponent(email.toLowerCase())}`);
    logger.debug({ email }, 'deleteAllowlistEntry: entry removed');
  } catch (err) {
    // Ignore 404 – entry may have been removed by a concurrent request
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      logger.info({ email }, 'deleteAllowlistEntry: entry not found (already deleted)');
      return;
    }
    handleUserApiError(err, {
      context: { email },
      operationName: 'deleteAllowlistEntry',
      forbiddenMsg: 'Unable to delete allowlist entry',
      unavailableActionMsg: 'delete allowlist entry',
    });
  }
}

/**
 * Creates or updates an allowlist entry in the Users API (idempotent).
 *
 * @param email - Email address to add/update.
 * @param role - Optional role to assign on onboarding.
 * @returns The upserted {@link UsersApiAllowlistEntry}.
 * @throws {UnavailableError} If the UserAPI is unreachable or returns a 5xx error.
 * @throws {DownstreamError} If the UserAPI returns an unexpected response.
 */
export async function upsertAllowlistEntry(
  email: string,
  role?: string,
): Promise<UsersApiAllowlistEntry> {
  logger.debug({ email, role }, 'upsertAllowlistEntry: upserting allowlist entry via UserAPI');
  try {
    const response = await client.post<{ success: boolean; data: UsersApiAllowlistEntry }>(
      '/api/v1/allowlist',
      { email: email.toLowerCase(), role },
    );
    logger.debug({ email }, 'upsertAllowlistEntry: entry upserted');
    return response.data.data;
  } catch (err) {
    handleUserApiError(err, {
      context: { email },
      operationName: 'upsertAllowlistEntry',
      forbiddenMsg: 'Unable to upsert allowlist entry',
      unavailableActionMsg: 'upsert allowlist entry',
    });
  }
}

