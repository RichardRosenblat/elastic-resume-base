import { ForbiddenError } from '../errors.js';
import { logger } from '../utils/logger.js';
import type {
  ListUsersResponse,
  PreApprovedFilters,
  PreApprovedUser,
  UpdatePreApprovedRequest,
  UpdateUserRequest,
  UserFilters,
  UserRecord,
  BatchUpdateUsersRequest,
  BatchUpdateUsersResponse,
  BatchDeleteUsersResponse,
  BatchUpdatePreApprovedRequest,
  BatchUpdatePreApprovedResponse,
  BatchDeletePreApprovedResponse,
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
  batchUpdateUsersInApi,
  batchDeleteUsersFromApi,
  batchDeletePreApprovedFromApi,
  batchUpdatePreApprovedInApi,
} from './userApiClient.js';

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
 * Lists users with optional pagination and filtering.
 */
export async function listUsers(maxResults?: number, pageToken?: string, filters?: UserFilters): Promise<ListUsersResponse> {
  logger.debug({ maxResults, hasPageToken: !!pageToken, filters }, 'listUsers: fetching users from UserAPI');
  return listUsersFromApi(maxResults, pageToken, filters);
}

/**
 * Updates a user. Only admins can update users; non-admins are not permitted
 * to update any fields.
 *
 * @param uid - UID of the user to update.
 * @param payload - Fields to update (`role` and/or `enable`).
 * @param requesterUid - UID of the user making the request.
 * @param requesterRole - Role of the user making the request.
 * @returns The updated UserRecord.
 * @throws {ForbiddenError} If a non-admin attempts any update.
 */
export async function updateUser(
  uid: string,
  payload: UpdateUserRequest,
  requesterUid: string,
  requesterRole: string,
): Promise<UserRecord> {
  if (requesterRole !== 'admin') {
    logger.warn({ uid, requesterUid }, 'updateUser: non-admin attempted to update a user');
    throw new ForbiddenError('Admin access required to update user accounts');
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
 * Lists all pre-approved users with optional filtering.
 * Requires admin role.
 *
 * @param requesterRole - Role of the user making the request.
 * @param filters - Optional filters (role).
 * @throws {ForbiddenError} If the requester is not an admin.
 */
export async function listPreApproved(requesterRole: string, filters?: PreApprovedFilters): Promise<PreApprovedUser[]> {
  if (requesterRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  logger.debug({ filters }, 'listPreApproved: fetching pre-approved users from UserAPI');
  return listPreApprovedFromApi(filters);
}

/**
 * Gets a specific pre-approved user by email.
 * Requires admin role.
 *
 * @param email - Email of the pre-approved user.
 * @param requesterRole - Role of the user making the request.
 * @throws {ForbiddenError} If the requester is not an admin.
 */
export async function getPreApproved(email: string, requesterRole: string): Promise<PreApprovedUser> {
  if (requesterRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
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

// ---------------------------------------------------------------------------
// Batch operations (admin only)
// ---------------------------------------------------------------------------

/**
 * Batch-updates multiple users. Requires admin role.
 *
 * @param data - Batch update payload (uids + fields to update).
 * @param requesterRole - Role of the user making the request.
 * @throws {ForbiddenError} If the requester is not an admin.
 */
export async function batchUpdateUsers(
  data: BatchUpdateUsersRequest,
  requesterRole: string,
): Promise<BatchUpdateUsersResponse> {
  if (requesterRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  logger.debug({ count: data.uids.length }, 'batchUpdateUsers: batch updating users via UserAPI');
  return batchUpdateUsersInApi(data);
}

/**
 * Batch-deletes multiple users. Requires admin role.
 *
 * @param uids - Array of UIDs to delete.
 * @param requesterRole - Role of the user making the request.
 * @throws {ForbiddenError} If the requester is not an admin.
 */
export async function batchDeleteUsers(
  uids: string[],
  requesterRole: string,
): Promise<BatchDeleteUsersResponse> {
  if (requesterRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  logger.debug({ count: uids.length }, 'batchDeleteUsers: batch deleting users via UserAPI');
  return batchDeleteUsersFromApi(uids);
}

/**
 * Batch-deletes multiple pre-approved users. Requires admin role.
 *
 * @param emails - Array of email addresses to delete.
 * @param requesterRole - Role of the user making the request.
 * @throws {ForbiddenError} If the requester is not an admin.
 */
export async function batchDeletePreApproved(
  emails: string[],
  requesterRole: string,
): Promise<BatchDeletePreApprovedResponse> {
  if (requesterRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  logger.debug({ count: emails.length }, 'batchDeletePreApproved: batch deleting pre-approved users via UserAPI');
  return batchDeletePreApprovedFromApi(emails);
}

/**
 * Batch-updates the role of multiple pre-approved users. Requires admin role.
 *
 * @param data - Batch update payload (emails + role).
 * @param requesterRole - Role of the user making the request.
 * @throws {ForbiddenError} If the requester is not an admin.
 */
export async function batchUpdatePreApproved(
  data: BatchUpdatePreApprovedRequest,
  requesterRole: string,
): Promise<BatchUpdatePreApprovedResponse> {
  if (requesterRole !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  logger.debug({ count: data.emails.length }, 'batchUpdatePreApproved: batch updating pre-approved users via UserAPI');
  return batchUpdatePreApprovedInApi(data);
}
