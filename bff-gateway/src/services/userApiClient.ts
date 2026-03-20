import axios from 'axios';
import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { ForbiddenError } from '../errors.js';

const client = createHttpClient(config.userApiServiceUrl);

/**
 * Retrieves the role of a single user from the UserAPI service.
 *
 * This is a placeholder implementation. When UserAPI is available, this function
 * will perform a real HTTP call. Until then, any network error causes it to fall
 * back to the default role of `'user'`.
 *
 * @param uid - Firebase user UID.
 * @returns The user's role string (e.g. `'admin'` or `'user'`).
 */
export async function getUserRole(uid: string): Promise<string> {
  logger.debug({ uid }, 'getUserRole: requesting role from UserAPI');

  try {
    const response = await client.get<{ success: boolean; data: { role: string } }>(
      `/users/${uid}/role`
    );

    const role = response.data.data.role;
    logger.debug({ uid, role }, 'getUserRole: role retrieved from UserAPI');

    return role;
  } catch (err) {
    logger.error({ uid, err }, 'UserAPI unavailable; denying access');
    throw new ForbiddenError('Unable to verify user role (UserAPI unavailable)');
  }
}

/**
 * Retrieves roles for multiple users from the UserAPI service in a single batch request.
 *
 * This is a placeholder implementation. When UserAPI is available, this function
 * will perform a real HTTP call. Until then, any network error causes it to fall
 * back to `'user'` for every UID in the input array.
 *
 * @param uids - Array of Firebase user UIDs.
 * @returns A map of `uid → role` for every provided UID.
 */
export async function getUserRolesBatch(uids: string[]): Promise<Record<string, string>> {
  // TODO: remove fallback once UserAPI is stable and always available
  logger.debug({ count: uids.length }, 'getUserRolesBatch: requesting batch roles from UserAPI');
  try {
    const response = await client.post<{ success: boolean; data: Record<string, string> }>('/users/roles/batch', { uids });
    logger.debug({ count: uids.length }, 'getUserRolesBatch: batch roles retrieved from UserAPI');
    return response.data.data;
  } catch (err) {
    logger.warn({ uids, err }, 'UserAPI unavailable; defaulting all roles to "user"');
    return Object.fromEntries(uids.map((uid) => [uid, 'user']));
  }
}

/**
 * Validates that the given user has access to this application by calling the UserAPI.
 *
 * Unlike `getUserRole`, this function explicitly throws a `ForbiddenError` when the
 * UserAPI returns HTTP 403, indicating the user is not a registered application user.
 * Network or availability errors are treated as non-blocking (graceful degradation).
 *
 * @param uid - Firebase user UID.
 * @returns The user's role string if access is granted.
 * @throws {ForbiddenError} If the UserAPI explicitly denies access (HTTP 403).
 */
export async function checkUserAccess(uid: string): Promise<string> {
  logger.debug({ uid }, 'checkUserAccess: verifying application access via UserAPI');
  try {
    const response = await client.get<{ success: boolean; data: { role: string } }>(`/users/${uid}/role`);
    const role = response.data.data.role;
    logger.debug({ uid, role }, 'checkUserAccess: access granted');
    return role;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 403) {
      logger.info({ uid }, 'checkUserAccess: UserAPI denied access (403)');
      throw new ForbiddenError('User does not have access to this application');
    }
    logger.warn({ uid, err }, 'UserAPI unavailable; skipping user access check');
    return 'user';
  }
}
