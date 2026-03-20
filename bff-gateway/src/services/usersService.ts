/**
 * NOTE: Use the modular 'getAuth(app)' syntax instead of the legacy 'admin.auth(app)'.
 * The legacy syntax often causes "admin.auth is not a function" errors in ESM/TypeScript 
 * environments due to module resolution behavior.
 */
import { getAuth } from 'firebase-admin/auth';
import type { UserRecord as FirebaseAuthUserRecord } from 'firebase-admin/auth';
import { getFirebaseApp } from '../middleware/auth.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserRecord,
  ListUsersResponse,
} from '../models/index.js';
import { getUserRoleByEmail, getUserRolesBatch } from './userApiClient.js';

/** Profile fields a non-admin user is permitted to change on their own account. */
const SELF_UPDATABLE_FIELDS = ['displayName', 'photoURL'] as const;

/**
 * Maps a Firebase Admin UserRecord to our UserRecord model.
 * @param record - Raw Firebase Auth user record.
 * @param role - Role string obtained from UserAPI.
 */
function mapUserRecord(record: FirebaseAuthUserRecord, role: string): UserRecord {
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
 * @param requesterEmail - Email of the user making the request.
 * @throws {ForbiddenError} If the requester is not an admin.
 */
async function checkAdminAccess(requesterEmail: string): Promise<void> {
  const role = await getUserRoleByEmail(requesterEmail);
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
 * @param requesterEmail - Email of the admin user making the request.
 * @returns The created UserRecord including the role fetched from UserAPI.
 * @throws {ForbiddenError} If the requester is not an admin.
 * @throws {ValidationError} If the email domain is not in the allowed list.
 */
export async function createUser(
  payload: CreateUserRequest,
  requesterEmail: string,
): Promise<UserRecord> {
  logger.debug({ requesterEmail }, 'createUser: checking admin access');
  await checkAdminAccess(requesterEmail);
  logger.debug({ email: payload.email }, 'createUser: validating email domain');
  validateEmailDomain(payload.email);

  const app = getFirebaseApp();
  logger.info({ action: 'createUser', email: payload.email, requesterEmail }, 'Creating new user');
  const record = await getAuth(app).createUser(payload);
  logger.debug({ uid: record.uid }, 'createUser: Firebase Auth user created, fetching role');
  const role = await getUserRoleByEmail(record.email ?? '');
  logger.debug({ uid: record.uid, role }, 'createUser: user created successfully');
  return mapUserRecord(record, role);
}

/**
 * Retrieves a Firebase Auth user by UID. Available to all authenticated users.
 *
 * @param uid - UID of the user to retrieve.
 * @returns The UserRecord including the role fetched from UserAPI.
 * @throws {NotFoundError} If the user does not exist.
 */
export async function getUserByUid(uid: string): Promise<UserRecord> {
  logger.debug({ uid }, 'getUserByUid: fetching user from Firebase Auth');
  const app = getFirebaseApp();
  try {
    const record = await getAuth(app).getUser(uid);
    logger.debug({ uid }, 'getUserByUid: fetching role from UserAPI');
    const role = await getUserRoleByEmail(record.email ?? '');
    logger.debug({ uid, role }, 'getUserByUid: user retrieved successfully');
    return mapUserRecord(record, role);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes('no user record')) {
      logger.debug({ uid }, 'getUserByUid: user not found in Firebase Auth');
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
  requesterEmail: string,
): Promise<UserRecord> {
  logger.debug({ uid, requesterEmail }, 'updateUser: checking requester role');
  const requesterRole = await getUserRoleByEmail(requesterEmail);
  const isAdmin = requesterRole === 'admin';

  const app = getFirebaseApp();

  if (!isAdmin) {
    // Non-admins may only update their own profile; verify by comparing emails
    try {
      const targetRecord = await getAuth(app).getUser(uid);
      if (targetRecord.email !== requesterEmail) {
        logger.warn(
          { uid, requesterEmail },
          'updateUser: non-admin attempted to update another user',
        );
        throw new ForbiddenError('You may only update your own profile');
      }
    } catch (err: unknown) {
      if (err instanceof ForbiddenError) throw err;
      if (err instanceof Error && err.message.toLowerCase().includes('no user record')) {
        logger.debug({ uid }, 'updateUser: user not found in Firebase Auth');
        throw new NotFoundError(`User ${uid} not found`);
      }
      throw err;
    }
  }

  let updatePayload: UpdateUserRequest;

  if (isAdmin) {
    if (payload.email) {
      logger.debug({ uid, email: payload.email }, 'updateUser: validating new email domain');
      validateEmailDomain(payload.email);
    }
    updatePayload = payload;
  } else {
    // Non-admins may only change non-sensitive profile fields
    updatePayload = Object.fromEntries(
      SELF_UPDATABLE_FIELDS.filter((field) => payload[field] !== undefined).map((field) => [
        field,
        payload[field],
      ]),
    ) as UpdateUserRequest;
    logger.debug(
      { uid, allowedFields: SELF_UPDATABLE_FIELDS },
      'updateUser: non-admin update restricted to safe fields',
    );
  }

  logger.info({ uid, action: 'updateUser', isAdmin }, 'Updating user');
  try {
    const record = await getAuth(app).updateUser(uid, updatePayload);
    logger.debug({ uid }, 'updateUser: Firebase Auth user updated, fetching role');
    const role = await getUserRoleByEmail(record.email ?? '');
    logger.debug({ uid, role }, 'updateUser: user updated successfully');
    return mapUserRecord(record, role);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes('no user record')) {
      logger.debug({ uid }, 'updateUser: user not found in Firebase Auth');
      throw new NotFoundError(`User ${uid} not found`);
    }
    throw err;
  }
}

/**
 * Deletes a Firebase Auth user by UID. Requires admin role.
 *
 * @param uid - UID of the user to delete.
 * @param requesterEmail - Email of the admin user making the request.
 * @throws {ForbiddenError} If the requester is not an admin.
 * @throws {NotFoundError} If the user does not exist.
 */
export async function deleteUser(uid: string, requesterEmail: string): Promise<void> {
  logger.debug({ uid, requesterEmail }, 'deleteUser: checking admin access');
  await checkAdminAccess(requesterEmail);

  const app = getFirebaseApp();
  logger.info({ uid, action: 'deleteUser', requesterEmail }, 'Deleting user');
  try {
    await getAuth(app).deleteUser(uid);
    logger.debug({ uid }, 'deleteUser: user deleted successfully from Firebase Auth');
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes('no user record')) {
      logger.debug({ uid }, 'deleteUser: user not found in Firebase Auth');
      throw new NotFoundError(`User ${uid} not found`);
    }
    throw err;
  }
}

/**
 * Lists Firebase Auth users with optional pagination. Available to all authenticated users.
 *
 * Roles for all returned users are fetched from UserAPI in a single batch call.
 *
 * @param maxResults - Maximum number of users to return (default 100, max 1000).
 * @param pageToken - Pagination token from a previous call.
 * @returns ListUsersResponse with users (including roles) and optional next page token.
 */
export async function listUsers(
  maxResults?: number,
  pageToken?: string,
): Promise<ListUsersResponse> {
  logger.debug({ maxResults, hasPageToken: !!pageToken }, 'listUsers: fetching from Firebase Auth');
  const app = getFirebaseApp();
  const result = await getAuth(app).listUsers(maxResults, pageToken);
  logger.debug(
    { count: result.users.length, hasNextPage: !!result.pageToken },
    'listUsers: fetching roles from UserAPI in batch',
  );
  const uids = result.users.map((u) => u.uid);
  const roles = await getUserRolesBatch(uids);

  logger.debug({ count: result.users.length }, 'listUsers: users retrieved successfully');
  return {
    users: result.users.map((u) => mapUserRecord(u, roles[u.uid] ?? 'user')),
    pageToken: result.pageToken,
  };
}
