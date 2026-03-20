import { ForbiddenError } from '../errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type {
  ListUsersResponse,
  PreApprovedUser,
  UpdatePreApprovedRequest,
  UpdateUserRequest,
  UserRecord,
} from '../models/index.js';
import {
  getUserById,
  listUsersFromApi,
  updateUserInApi,
  deleteUserFromApi,
  listPreApprovedFromApi,
  getPreApprovedFromApi,
  addPreApprovedInApi,
  deletePreApprovedFromApi,
  updatePreApprovedInApi,
} from './userApiClient.js';

/** Fields a non-admin user is permitted to change on their own account. */
const SELF_UPDATABLE_FIELDS: (keyof UpdateUserRequest)[] = ['email'];

/** Fields that only an admin user can change. */
const ADMIN_ONLY_FIELDS: (keyof UpdateUserRequest)[] = ['role', 'enable'];

/**
 * Validates that the email's domain is within the configured list of allowed domains.
 *
 * @param email - Email address to validate.
 * @throws {ForbiddenError} If the domain is not in the allowed list.
 */
function validateEmailDomain(email: string): void {
  const allowedDomains = config.allowedEmailDomains
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  if (allowedDomains.length === 0) {
    return;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || !allowedDomains.includes(domain)) {
    throw new ForbiddenError(
      `Email domain is not allowed. Permitted domains: ${allowedDomains.join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
// User management (proxied to users-api)
// ---------------------------------------------------------------------------

/**
 * Retrieves a single user by UID.
 */
export async function getUserByUid(uid: string): Promise<UserRecord> {
  logger.debug({ uid }, 'getUserByUid: fetching user from UserAPI');
  return getUserById(uid);
}

/**
 * Lists users with optional pagination.
 */
export async function listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResponse> {
  logger.debug({ maxResults, hasPageToken: !!pageToken }, 'listUsers: fetching users from UserAPI');
  return listUsersFromApi(maxResults, pageToken);
}

/**
 * Updates a user. Admins can update any field; non-admins can only update their own
 * safe fields (email).
 *
 * @param uid - UID of the user to update.
 * @param payload - Fields to update.
 * @param requesterUid - UID of the user making the request.
 * @param requesterRole - Role of the user making the request.
 * @returns The updated UserRecord.
 * @throws {ForbiddenError} If a non-admin tries to update another user or restricted fields.
 */
export async function updateUser(
  uid: string,
  payload: UpdateUserRequest,
  requesterUid: string,
  requesterRole: string,
): Promise<UserRecord> {
  const isAdmin = requesterRole === 'admin';

  if (!isAdmin) {
    if (uid !== requesterUid) {
      logger.warn({ uid, requesterUid }, 'updateUser: non-admin tried to update another user');
      throw new ForbiddenError('You may only update your own profile');
    }

    // Non-admins cannot update role or enable
    for (const field of ADMIN_ONLY_FIELDS) {
      if (payload[field] !== undefined) {
        logger.warn({ uid, field }, 'updateUser: non-admin tried to update restricted field');
        throw new ForbiddenError(`You do not have permission to update the '${field}' field`);
      }
    }

    // Restrict to safe fields only
    const safePayload: UpdateUserRequest = {};
    for (const field of SELF_UPDATABLE_FIELDS) {
      if (payload[field] !== undefined) {
        (safePayload as Record<string, unknown>)[field] = payload[field];
      }
    }

    if (safePayload.email) {
      validateEmailDomain(safePayload.email);
    }

    logger.debug({ uid, requesterUid }, 'updateUser: non-admin self-update');
    return updateUserInApi(uid, safePayload);
  }

  // Admin update — validate email domain if email is being changed
  if (payload.email) {
    validateEmailDomain(payload.email);
  }

  logger.debug({ uid, requesterUid }, 'updateUser: admin update');
  return updateUserInApi(uid, payload);
}

/**
 * Deletes a user. Requires admin role.
 *
 * @param uid - UID of the user to delete.
 * @param requesterRole - Role of the user making the request.
 * @throws {ForbiddenError} If the requester is not an admin.
 */
export async function deleteUser(uid: string, requesterRole: string): Promise<void> {
  if (requesterRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  logger.debug({ uid }, 'deleteUser: deleting user via UserAPI');
  return deleteUserFromApi(uid);
}

// ---------------------------------------------------------------------------
// Pre-approve management (admin only)
// ---------------------------------------------------------------------------

/**
 * Lists all pre-approved users.
 */
export async function listPreApproved(): Promise<PreApprovedUser[]> {
  logger.debug('listPreApproved: fetching pre-approved users from UserAPI');
  return listPreApprovedFromApi();
}

/**
 * Gets a specific pre-approved user by email.
 */
export async function getPreApproved(email: string): Promise<PreApprovedUser> {
  logger.debug({ email }, 'getPreApproved: fetching pre-approved user from UserAPI');
  return getPreApprovedFromApi(email);
}

/**
 * Adds a user to the pre-approved list. Requires admin role.
 */
export async function addPreApproved(
  email: string,
  role: string,
  requesterRole: string,
): Promise<PreApprovedUser> {
  if (requesterRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  validateEmailDomain(email);
  logger.debug({ email, role }, 'addPreApproved: adding pre-approved user via UserAPI');
  return addPreApprovedInApi(email, role);
}

/**
 * Deletes a pre-approved user. Requires admin role.
 */
export async function deletePreApproved(email: string, requesterRole: string): Promise<void> {
  if (requesterRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  logger.debug({ email }, 'deletePreApproved: deleting pre-approved user via UserAPI');
  return deletePreApprovedFromApi(email);
}

/**
 * Updates a pre-approved user. Requires admin role.
 */
export async function updatePreApproved(
  email: string,
  data: UpdatePreApprovedRequest,
  requesterRole: string,
): Promise<PreApprovedUser> {
  if (requesterRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  logger.debug({ email }, 'updatePreApproved: updating pre-approved user via UserAPI');
  return updatePreApprovedInApi(email, data);
}
