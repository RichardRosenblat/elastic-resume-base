import axios from 'axios';
import { config } from '../config.js';
import { DownstreamError, ForbiddenError, UnavailableError } from '../errors.js';
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
