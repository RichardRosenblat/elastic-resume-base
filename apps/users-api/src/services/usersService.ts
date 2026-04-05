import { ForbiddenError } from '../errors.js';
import {
  FirestoreUserDocumentStore,
  FirestorePreApprovedStore,
  type IUserDocumentStore,
  type IPreApprovedStore,
} from '@elastic-resume-base/synapse';
import { config } from '../config.js';
import type {
  AuthorizeRequest,
  AuthorizeResponse,
  BatchDeleteUsersResponse,
  BatchUpdateUsersRequest,
  BatchUpdateUsersResponse,
  ListUsersResponse,
  UpdateUserRequest,
  UserFilters,
  UserRecord,
} from '../models/index.js';
import { logger } from '../utils/logger.js';

/** Default role assigned to newly created users. */
const DEFAULT_ROLE = 'user';

/**
 * Compares two field values for sorting purposes.
 *
 * Booleans are ordered with `true` before `false` (i.e., enabled users first
 * when sorting by `enable`).  All other values are compared as strings using
 * locale-insensitive case-folding so that `"Admin"` and `"admin"` sort equally.
 *
 * @param a - First value to compare.
 * @param b - Second value to compare.
 * @returns Negative if `a` should sort before `b`, positive if after, zero if equal.
 */
function compareValues(a: string | boolean, b: string | boolean): number {
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    if (a === b) return 0;
    return a ? 1 : -1;
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

/**
 * Returns a sorted copy of the provided user list.
 *
 * The sort field and direction are taken from `filters.orderBy` and
 * `filters.orderDirection`.  Defaults to ascending order by `uid`.
 * The original array is not mutated.
 *
 * @param users - Unsorted array of user records.
 * @param filters - Optional filtering/sorting options.
 * @returns A new array of user records sorted according to `filters`.
 */
function sortUsers(users: UserRecord[], filters?: UserFilters): UserRecord[] {
  const orderBy = filters?.orderBy ?? 'uid';
  const orderDirection = filters?.orderDirection ?? 'asc';

  const sorted = [...users].sort((left, right) => {
    const result = compareValues(left[orderBy], right[orderBy]);
    return orderDirection === 'desc' ? -result : result;
  });

  return sorted;
}

// ---------------------------------------------------------------------------
// Store singletons (lazy-initialized on first call)
// ---------------------------------------------------------------------------

let _userStore: IUserDocumentStore | null = null;
let _preApprovedStore: IPreApprovedStore | null = null;

function getUserStore(): IUserDocumentStore {
  if (!_userStore) {
    _userStore = new FirestoreUserDocumentStore(config.firestoreUsersCollection);
  }
  return _userStore;
}

function getPreApprovedStore(): IPreApprovedStore {
  if (!_preApprovedStore) {
    _preApprovedStore = new FirestorePreApprovedStore(config.firestorePreApprovedUsersCollection);
  }
  return _preApprovedStore;
}

/**
 * Resets the store singletons. Intended for use in tests only.
 * @internal
 */
export function _resetStores(): void {
  _userStore = null;
  _preApprovedStore = null;
}

// ---------------------------------------------------------------------------
// Authorization Logic
// ---------------------------------------------------------------------------

/**
 * Resolves a comma-separated pattern list from config into an array of trimmed,
 * non-empty strings.  Returns `null` when the config value is `undefined` so the
 * caller can distinguish "env var never set" from "env var explicitly set to empty".
 *
 * - `undefined` → `null`  (env var not set; caller may apply fallback logic)
 * - `""`        → `[]`    (env var set to empty; feature explicitly disabled)
 * - `"a,b"`     → `["a","b"]` (feature active with the given patterns)
 *
 * @internal
 */
function parsePatternList(value: string | undefined): string[] | null {
  if (value === undefined) return null;
  return value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Returns `true` if `email` matches any pattern in `patterns`.
 *
 * Pattern formats supported:
 * - `"example.com"` or `"@example.com"` — matches any address whose domain is `example.com`
 * - `"user@example.com"` — exact email match (case-insensitive)
 *
 * @internal
 */
export function matchesEmailOrDomain(email: string, patterns: string[]): boolean {
  const normalizedEmail = email.toLowerCase();
  const domain = normalizedEmail.split('@')[1];
  if (!domain) return false;

  return patterns.some((pattern) => {
    const p = pattern.toLowerCase();

    // "@example.com" — strip leading "@" and compare as domain
    if (p.startsWith('@')) {
      return p.slice(1) === domain;
    }

    // "example.com" — plain domain match
    if (!p.includes('@')) {
      return p === domain;
    }

    // "user@example.com" — exact email match
    return p === normalizedEmail;
  });
}

/**
 * Implements the Gateway API Authorization Logic.
 *
 * Resolution order:
 * 1. Check users store by uid — if found, return role and enable status.
 * 2. Check pre-approved store by email — if found, promote to users with enable=true.
 * 3. Check AUTO_ADMIN_CREATION_DOMAINS — if matched, create with role=admin, enable=true.
 * 4. Check AUTO_USER_CREATION_DOMAINS (or legacy ONBOARDABLE_EMAIL_DOMAINS) — if matched,
 *    create with role=user, enable=false.
 * 5. Return 403 if no match.
 *
 * Auto-creation behaviour per env var state:
 * - Env var **not set** (undefined): feature uses its default/fallback behaviour.
 * - Env var **set to empty string**: feature is explicitly disabled (no auto-creation).
 * - Env var **set to a list**: auto-creation applies only for matching addresses.
 *
 * @param request - Object containing uid and email from the Firebase token.
 * @returns The user's role and enable status.
 * @throws {ForbiddenError} If the user is not allowed access.
 */
export async function authorizeUser(request: AuthorizeRequest): Promise<AuthorizeResponse> {
  const { uid, email } = request;
  logger.debug({ uid, email }, 'authorizeUser: starting authorization');

  const userStore = getUserStore();
  const preApprovedStore = getPreApprovedStore();

  // Step 1: Check users store by uid
  logger.trace({ uid }, 'authorizeUser: checking users store');
  try {
    const user = await userStore.getUserByUid(uid);
    logger.debug(
      { uid, role: user.role, enable: user.enable },
      'authorizeUser: user found in users store',
    );
    // Auto-update email if it has changed in the auth provider
    if (user.email !== email) {
      logger.info(
        { uid, oldEmail: user.email, newEmail: email },
        'authorizeUser: email has changed, updating user record',
      );
      try {
        await userStore.updateUser(uid, { email });
      } catch (updateErr) {
        // Non-fatal: log and continue with existing record
        logger.warn(
          { uid, err: updateErr },
          'authorizeUser: failed to update email, continuing with existing record',
        );
      }
    }
    return { role: user.role, enable: user.enable };
  } catch (err) {
    // Use code-based check instead of `instanceof` to guard against module identity
    // mismatches: error classes bundled inside external modules (e.g. Synapse) are
    // separate class objects at runtime, so `instanceof` can return false for a logically
    // equivalent error.  Comparing the `.code` string is always safe across module boundaries.
    if ((err as { code?: string }).code !== 'NOT_FOUND') throw err;
  }

  // Step 2: Check pre-approved store by email
  logger.trace({ email }, 'authorizeUser: checking pre-approved store');
  const preApproved = await preApprovedStore.getByEmail(email);
  if (preApproved) {
    const role = preApproved.role;
    logger.info(
      { uid, email, role },
      'authorizeUser: user found in pre-approved store, promoting to users store',
    );

    await userStore.createUser({ uid, email, role, enable: true });
    await preApprovedStore.delete(email);

    logger.debug({ uid, email, role }, 'authorizeUser: user promoted successfully');
    return { role, enable: true };
  }

  // Step 3: Check AUTO_ADMIN_CREATION_DOMAINS — creates admin users automatically
  const adminPatterns = parsePatternList(config.autoAdminCreationDomains);
  if (adminPatterns !== null && adminPatterns.length > 0 && matchesEmailOrDomain(email, adminPatterns)) {
    logger.info(
      { uid, email },
      'authorizeUser: email matches AUTO_ADMIN_CREATION_DOMAINS, creating admin user with enable=true',
    );
    await userStore.createUser({ uid, email, role: 'admin', enable: true });
    return { role: 'admin', enable: true };
  }

  // Step 4: Check AUTO_USER_CREATION_DOMAINS (with legacy ONBOARDABLE_EMAIL_DOMAINS fallback)
  // AUTO_USER_CREATION_DOMAINS takes precedence when set (even to empty, which disables it).
  // Falls back to ONBOARDABLE_EMAIL_DOMAINS when AUTO_USER_CREATION_DOMAINS is not set.
  const userPatternsRaw = config.autoUserCreationDomains ?? config.onboardableEmailDomains;
  const userPatterns = parsePatternList(userPatternsRaw);
  if (userPatterns !== null && userPatterns.length > 0 && matchesEmailOrDomain(email, userPatterns)) {
    logger.info(
      { uid, email },
      'authorizeUser: email matches user creation domains, creating user with enable=false',
    );
    await userStore.createUser({ uid, email, role: DEFAULT_ROLE, enable: false });
    return { role: DEFAULT_ROLE, enable: false };
  }

  // Step 5: No access
  logger.info({ uid, email }, 'authorizeUser: user has no access');
  throw new ForbiddenError('User does not have access to this application');
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Retrieves a user by UID.
 *
 * @param uid - Unique identifier of the user.
 * @returns The corresponding {@link UserRecord}.
 * @throws {NotFoundError} If no user with that UID exists.
 */
export async function getUserByUid(uid: string): Promise<UserRecord> {
  logger.debug({ uid }, 'getUserByUid: fetching user');
  const user = await getUserStore().getUserByUid(uid);
  logger.trace({ uid }, 'getUserByUid: user retrieved');
  return user;
}

/**
 * Looks up a user by email address.
 *
 * @param email - Email address to search for.
 * @returns The matching {@link UserRecord}, or `null` if not found.
 */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  logger.debug({ email }, 'getUserByEmail: fetching user');
  const user = await getUserStore().getUserByEmail(email);
  if (user) logger.trace({ email }, 'getUserByEmail: user found');
  return user ?? null;
}

/** Upper-bound page size used when listing all admins for the last-admin guard. */
const MAX_ADMIN_FETCH = 10_000;

/**
 * Counts the number of currently enabled admin users.
 *
 * @returns Total count of enabled admin users in the store.
 */
async function countEnabledAdmins(): Promise<number> {
  const result = await getUserStore().listUsers(MAX_ADMIN_FETCH, undefined, { role: 'admin', enable: true });
  return result.users.length;
}

/**
 * Updates mutable attributes of a user.
 *
 * Guards against removing the last enabled admin:
 * - If the target user is an enabled admin and the update would disable them or
 *   demote their role to `'user'`, this function checks whether they are the
 *   last enabled admin and rejects the change if so.
 *
 * @param uid - Unique identifier of the user to update.
 * @param data - Fields to update. Only supplied fields are changed.
 * @returns The updated {@link UserRecord}.
 * @throws {NotFoundError} If no user with that UID exists.
 * @throws {ForbiddenError} If the update would remove the last enabled admin.
 */
export async function updateUser(uid: string, data: UpdateUserRequest): Promise<UserRecord> {
  const wouldDisable = data.enable === false;
  const wouldDemote = data.role !== undefined && data.role !== 'admin';

  if (wouldDisable || wouldDemote) {
    const current = await getUserStore().getUserByUid(uid);
    const isCurrentAdmin = current.role === 'admin' && current.enable;

    if (isCurrentAdmin) {
      const adminCount = await countEnabledAdmins();
      if (adminCount <= 1) {
        const reason = wouldDisable
          ? 'You cannot deactivate this user because they are the only active admin in the system. Please assign another user as admin before deactivating this user.'
          : 'You cannot change the role of this user because they are the only active admin in the system. Please assign another user as admin before changing their role.';
        throw new ForbiddenError(reason);
      }
    }
  }

  logger.debug({ uid }, 'updateUser: updating user');
  const user = await getUserStore().updateUser(uid, data);
  logger.info({ uid, action: 'updateUser' }, 'User updated');
  return user;
}

/**
 * Permanently removes a user.
 *
 * Guards against deleting the last enabled admin.
 *
 * @param uid - Unique identifier of the user to delete.
 * @throws {NotFoundError} If no user with that UID exists.
 * @throws {ForbiddenError} If deleting this user would leave no enabled admin.
 */
export async function deleteUser(uid: string): Promise<void> {
  const current = await getUserStore().getUserByUid(uid);
  if (current.role === 'admin' && current.enable) {
    const adminCount = await countEnabledAdmins();
    if (adminCount <= 1) {
      throw new ForbiddenError(
        'You cannot delete this user because they are the only active admin in the system. Please assign another user as admin before deleting this user.',
      );
    }
  }

  logger.debug({ uid }, 'deleteUser: removing user');
  await getUserStore().deleteUser(uid);
  logger.info({ uid, action: 'deleteUser' }, 'User deleted');
}

/**
 * Lists users with optional pagination and filtering.
 *
 * @param maxResults - Maximum number of results to return (default: 100).
 * @param pageToken - Opaque pagination token from a previous call.
 * @param filters - Optional filters (role, enable).
 * @returns A {@link ListUsersResponse} with the page of users and an optional next-page token.
 */
export async function listUsers(
  maxResults = 100,
  pageToken?: string,
  filters?: UserFilters,
): Promise<ListUsersResponse> {
  logger.debug({ maxResults, hasPageToken: !!pageToken, filters }, 'listUsers: building query');
  const storeFilters: UserFilters = {};
  if (filters?.email !== undefined) storeFilters.email = filters.email;
  if (filters?.role !== undefined) storeFilters.role = filters.role;
  if (filters?.enable !== undefined) storeFilters.enable = filters.enable;
  const finalStoreFilters = Object.keys(storeFilters).length > 0 ? storeFilters : undefined;

  const result = await getUserStore().listUsers(maxResults, pageToken, finalStoreFilters);
  const users = sortUsers(result.users, filters);
  logger.debug(
    { count: users.length, hasNextPage: !!result.pageToken },
    'listUsers: query complete',
  );
  return { users, pageToken: result.pageToken };
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

/**
 * Batch-updates multiple users in a single operation.
 *
 * Applies the same field update(s) to every UID in the list.
 * Implements the last-admin guard: if the operation would disable or demote
 * all remaining enabled admins, the request is rejected.
 *
 * @param uids - Array of user UIDs to update.
 * @param data - Fields to update (role and/or enable).
 * @returns An object containing the count of successfully updated users.
 * @throws {ForbiddenError} If the update would remove the last enabled admin.
 */
export async function batchUpdateUsers(
  uids: string[],
  data: BatchUpdateUsersRequest,
): Promise<BatchUpdateUsersResponse> {
  const wouldDisable = data.enable === false;
  const wouldDemote = data.role !== undefined && data.role !== 'admin';

  if (wouldDisable || wouldDemote) {
    const { users: allAdmins } = await getUserStore().listUsers(MAX_ADMIN_FETCH, undefined, { role: 'admin', enable: true });
    const adminCount = allAdmins.length;
    const targetAdminCount = allAdmins.filter((u: { uid: string }) => uids.includes(u.uid)).length;
    const remainingAdmins = adminCount - targetAdminCount;

    if (remainingAdmins < 1) {
      const reason = wouldDisable
        ? 'You cannot deactivate these users because they include all active admins in the system. Please assign another user as admin before deactivating.'
        : 'You cannot change the role of these users because they include all active admins in the system. Please assign another user as admin before changing their role.';
      throw new ForbiddenError(reason);
    }
  }

  logger.debug({ count: uids.length }, 'batchUpdateUsers: updating users');
  const { role, enable } = data;
  const updateData: UpdateUserRequest = {};
  if (role !== undefined) updateData.role = role;
  if (enable !== undefined) updateData.enable = enable;

  const results = await Promise.allSettled(
    uids.map(async (uid) => {
      await getUserStore().updateUser(uid, updateData);
    }),
  );

  let updated = 0;
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      updated++;
    } else if ((result.reason as { code?: string }).code === 'NOT_FOUND') {
      logger.warn({ uid: uids[i] }, 'batchUpdateUsers: user not found, skipping');
    } else {
      throw result.reason;
    }
  }

  logger.info({ requested: uids.length, updated, action: 'batchUpdateUsers' }, 'Batch user update complete');
  return { updated };
}

/**
 * Batch-deletes multiple users in a single operation.
 *
 * Implements the last-admin guard: if the operation would delete all remaining
 * enabled admins, the request is rejected.
 *
 * @param uids - Array of user UIDs to delete.
 * @returns An object containing the count of successfully deleted users.
 * @throws {ForbiddenError} If the operation would remove the last enabled admin.
 */
export async function batchDeleteUsers(uids: string[]): Promise<BatchDeleteUsersResponse> {
  const { users: allAdmins } = await getUserStore().listUsers(MAX_ADMIN_FETCH, undefined, { role: 'admin', enable: true });
  const adminCount = allAdmins.length;
  const targetAdminCount = allAdmins.filter((u: { uid: string }) => uids.includes(u.uid)).length;
  const remainingAdmins = adminCount - targetAdminCount;

  if (remainingAdmins < 1 && targetAdminCount > 0) {
    throw new ForbiddenError(
      'You cannot delete these users because they include all active admins in the system. Please assign another user as admin before deleting.',
    );
  }

  logger.debug({ count: uids.length }, 'batchDeleteUsers: deleting users');
  const results = await Promise.allSettled(
    uids.map(async (uid) => {
      await getUserStore().deleteUser(uid);
    }),
  );

  let deleted = 0;
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      deleted++;
    } else if ((result.reason as { code?: string }).code === 'NOT_FOUND') {
      logger.warn({ uid: uids[i] }, 'batchDeleteUsers: user not found, skipping');
    } else {
      throw result.reason;
    }
  }

  logger.info({ requested: uids.length, deleted, action: 'batchDeleteUsers' }, 'Batch user delete complete');
  return { deleted };
}

// ---------------------------------------------------------------------------
// Bootstrapping and onready functions
// ---------------------------------------------------------------------------

/**
 * Bootstraps the admin user based on the configuration.
 * Adds the admin email to the pre-approved store if it does not already exist
 * in either the users store or the pre-approved store.
 * @returns A promise that resolves when the admin user has been pre-approved or skipped.
 */
export async function bootstrapAdminUser(): Promise<void> {
  if (!config.bootstrapAdminUserEmail) {
    logger.warn('No bootstrap admin email configured; skipping admin user creation');
    return;
  }

  const email = config.bootstrapAdminUserEmail;
  logger.info({ email }, 'Bootstrapping admin user from configuration email');

  const userStore = getUserStore();
  const preApprovedStore = getPreApprovedStore();

  // Idempotency check: is there already a user with this email in users store?
  const existingUser = await userStore.getUserByEmail(email);
  if (existingUser) {
    logger.info({ email }, 'Admin user already exists in users store; skipping pre-approval');
    return;
  }

  // Idempotency check: is the email already in pre-approved store?
  const existingPreApproved = await preApprovedStore.getByEmail(email);
  if (existingPreApproved) {
    logger.info({ email }, 'Admin email already in pre-approved store; skipping');
    return;
  }

  // Add to pre-approved store with admin role
  try {
    await preApprovedStore.add({ email, role: 'admin' });
    logger.info({ email }, 'Admin email added to pre-approved store successfully');
  } catch (error) {
    logger.error({ email, error }, 'Error occurred while bootstrapping admin user');
  }
}
