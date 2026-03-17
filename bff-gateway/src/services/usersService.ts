import * as admin from 'firebase-admin';
import { getFirebaseApp } from '../middleware/auth.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type { CreateUserRequest, UpdateUserRequest, UserRecord, ListUsersResponse } from '../models/index.js';
import { getUserRole, getUserRolesBatch } from './userApiClient.js';

/** Profile fields a non-admin user is permitted to change on their own account. */
const SELF_UPDATABLE_FIELDS = ['displayName', 'photoURL'] as const;

/**
 * Maps a Firebase Admin UserRecord to our UserRecord model.
 * @param record - Raw Firebase Auth user record.
 * @param role - Role string obtained from UserAPI.
 */
function mapUserRecord(record: admin.auth.UserRecord, role: string): UserRecord {
  return {
    uid: record.uid,
    email: record.email,
    displayName: record.displayName,
    photoURL: record.photoURL,
    disabled: record.disabled,
    emailVerified: record.emailVerified,
    role,
    createdAt: record.metadata.creationTime,
    lastLoginAt: record.metadata.lastSignInTime,
  };
}

/**
 * Asserts that the requesting user holds the `admin` role.
 * @param requesterUid - UID of the user making the request.
 * @throws {ForbiddenError} If the requester is not an admin.
 */
async function checkAdminAccess(requesterUid: string): Promise<void> {
  const role = await getUserRole(requesterUid);
  if (role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
}

/**
 * Validates that the email's domain is within the configured list of allowed domains.
 *
 * An empty `ALLOWED_EMAIL_DOMAINS` configuration means no domain restrictions are applied.
 *
 * @param email - Email address to validate.
 * @throws {ValidationError} If the domain is not in the allowed list.
 */
function validateEmailDomain(email: string): void {
  const allowedDomains = config.allowedEmailDomains
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  // TODO: implement more robust check (e.g. DNS validation, wildcard support, disposable-email detection)
  if (allowedDomains.length === 0) {
    return; // No domain restriction configured — all domains are allowed
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || !allowedDomains.includes(domain)) {
    throw new ValidationError(
      `Email domain is not allowed. Permitted domains: ${allowedDomains.join(', ')}`,
    );
  }
}

/**
 * Creates a new Firebase Auth user. Requires admin role.
 *
 * @param payload - User creation data.
 * @param requesterUid - UID of the admin user making the request.
 * @returns The created UserRecord including the role fetched from UserAPI.
 * @throws {ForbiddenError} If the requester is not an admin.
 * @throws {ValidationError} If the email domain is not in the allowed list.
 */
export async function createUser(payload: CreateUserRequest, requesterUid: string): Promise<UserRecord> {
  await checkAdminAccess(requesterUid);
  validateEmailDomain(payload.email);

  const app = getFirebaseApp();
  logger.info({ action: 'createUser' }, 'Creating new user');
  const record = await admin.auth(app).createUser(payload);
  const role = await getUserRole(record.uid);
  return mapUserRecord(record, role);
}

/**
 * Retrieves a Firebase Auth user by UID.
 *
 * Admins may retrieve any user. Non-admins may only retrieve their own profile.
 *
 * @param uid - UID of the user to retrieve.
 * @param requesterUid - UID of the user making the request.
 * @returns The UserRecord including the role fetched from UserAPI.
 * @throws {NotFoundError} If the user does not exist.
 * @throws {ForbiddenError} If a non-admin attempts to retrieve another user's profile.
 */
export async function getUserByUid(uid: string, requesterUid: string): Promise<UserRecord> {
  const requesterRole = await getUserRole(requesterUid);
  if (requesterRole !== 'admin' && uid !== requesterUid) {
    throw new ForbiddenError('You may only access your own profile');
  }

  const app = getFirebaseApp();
  try {
    const record = await admin.auth(app).getUser(uid);
    const role = await getUserRole(uid);
    return mapUserRecord(record, role);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes('no user record')) {
      throw new NotFoundError(`User ${uid} not found`);
    }
    throw err;
  }
}

/**
 * Updates a Firebase Auth user by UID.
 *
 * Admins may update any user with all payload fields.
 * Non-admins may only update their own profile and are restricted to
 * non-sensitive fields: `displayName` and `photoURL`.
 *
 * @param uid - UID of the user to update.
 * @param payload - Fields to update.
 * @param requesterUid - UID of the user making the request.
 * @returns The updated UserRecord including the role fetched from UserAPI.
 * @throws {ForbiddenError} If a non-admin attempts to update another user's profile.
 * @throws {ValidationError} If an admin sets a new email with a disallowed domain.
 * @throws {NotFoundError} If the user does not exist.
 */
export async function updateUser(
  uid: string,
  payload: UpdateUserRequest,
  requesterUid: string,
): Promise<UserRecord> {
  const requesterRole = await getUserRole(requesterUid);
  const isAdmin = requesterRole === 'admin';

  if (!isAdmin && uid !== requesterUid) {
    throw new ForbiddenError('You may only update your own profile');
  }

  let updatePayload: UpdateUserRequest;

  if (isAdmin) {
    if (payload.email) {
      validateEmailDomain(payload.email);
    }
    updatePayload = payload;
  } else {
    // Non-admins may only change non-sensitive profile fields
    updatePayload = Object.fromEntries(
      SELF_UPDATABLE_FIELDS.filter((field) => payload[field] !== undefined).map(
        (field) => [field, payload[field]],
      ),
    ) as UpdateUserRequest;
  }

  const app = getFirebaseApp();
  logger.info({ uid, action: 'updateUser' }, 'Updating user');
  try {
    const record = await admin.auth(app).updateUser(uid, updatePayload);
    const role = await getUserRole(uid);
    return mapUserRecord(record, role);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes('no user record')) {
      throw new NotFoundError(`User ${uid} not found`);
    }
    throw err;
  }
}

/**
 * Deletes a Firebase Auth user by UID. Requires admin role.
 *
 * @param uid - UID of the user to delete.
 * @param requesterUid - UID of the admin user making the request.
 * @throws {ForbiddenError} If the requester is not an admin.
 * @throws {NotFoundError} If the user does not exist.
 */
export async function deleteUser(uid: string, requesterUid: string): Promise<void> {
  await checkAdminAccess(requesterUid);

  const app = getFirebaseApp();
  logger.info({ uid, action: 'deleteUser' }, 'Deleting user');
  try {
    await admin.auth(app).deleteUser(uid);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes('no user record')) {
      throw new NotFoundError(`User ${uid} not found`);
    }
    throw err;
  }
}

/**
 * Lists Firebase Auth users with optional pagination. Requires admin role.
 *
 * Roles for all returned users are fetched from UserAPI in a single batch call.
 *
 * @param requesterUid - UID of the admin user making the request.
 * @param maxResults - Maximum number of users to return (default 100, max 1000).
 * @param pageToken - Pagination token from a previous call.
 * @returns ListUsersResponse with users (including roles) and optional next page token.
 * @throws {ForbiddenError} If the requester is not an admin.
 */
export async function listUsers(
  requesterUid: string,
  maxResults?: number,
  pageToken?: string,
): Promise<ListUsersResponse> {
  await checkAdminAccess(requesterUid);

  const app = getFirebaseApp();
  const result = await admin.auth(app).listUsers(maxResults, pageToken);
  const uids = result.users.map((u) => u.uid);
  const roles = await getUserRolesBatch(uids);

  return {
    users: result.users.map((u) => mapUserRecord(u, roles[u.uid] ?? 'user')),
    pageToken: result.pageToken,
  };
}

