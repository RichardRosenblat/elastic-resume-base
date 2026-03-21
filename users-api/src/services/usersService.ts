import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
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
  CreateUserRequest,
  ListUsersResponse,
  UpdateUserRequest,
  UserFilters,
  UserRecord,
} from '../models/index.js';
import { logger } from '../utils/logger.js';

/** Default role assigned to newly created users. */
const DEFAULT_ROLE = 'user';

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

/**
 * Validates that the email field is present and is a non-empty string.
 */
function validateEmail(email: string): void {
  if (!email || !email.includes('@')) {
    throw new ValidationError('A valid email address is required');
  }
}

// ---------------------------------------------------------------------------
// Authorization Logic
// ---------------------------------------------------------------------------

/**
 * Implements the BFF Authorization Logic.
 *
 * Resolution order:
 * 1. Check users store by uid — if found, return role and enable status.
 * 2. Check pre-approved store by email — if found, promote to users with enable=true.
 * 3. Check email domain against ONBOARDABLE_EMAIL_DOMAINS — if matched, create with enable=false.
 * 4. Return 403 if no match.
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
    logger.debug({ uid, role: user.role, enable: user.enable }, 'authorizeUser: user found in users store');
    return { role: user.role, enable: user.enable };
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err;
  }

  // Step 2: Check pre-approved store by email
  logger.trace({ email }, 'authorizeUser: checking pre-approved store');
  const preApproved = await preApprovedStore.getByEmail(email);
  if (preApproved) {
    const role = preApproved.role;
    logger.info({ uid, email, role }, 'authorizeUser: user found in pre-approved store, promoting to users store');

    await userStore.createUser({ uid, email, role, enable: true });
    await preApprovedStore.delete(email);

    logger.debug({ uid, email, role }, 'authorizeUser: user promoted successfully');
    return { role, enable: true };
  }

  // Step 3: Check email domain
  const onboardableDomains = config.onboardableEmailDomains
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  if (onboardableDomains.length > 0) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && onboardableDomains.includes(domain)) {
      logger.info({ uid, email, domain }, 'authorizeUser: email domain is onboardable, creating user with enable=false');
      await userStore.createUser({ uid, email, role: DEFAULT_ROLE, enable: false });
      return { role: DEFAULT_ROLE, enable: false };
    }
  }

  // Step 4: No access
  logger.info({ uid, email }, 'authorizeUser: user has no access');
  throw new ForbiddenError('User does not have access to this application');
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Creates a new user.
 *
 * @param data - User creation payload.
 * @returns The newly created {@link UserRecord}.
 * @throws {ValidationError} If the email is missing or invalid.
 * @throws {ConflictError} If a user with the same uid already exists.
 */
export async function createUser(data: CreateUserRequest): Promise<UserRecord> {
  logger.debug({ email: data.email }, 'createUser: validating email');
  validateEmail(data.email);

  const userStore = getUserStore();
  const { uid, email, role, enable } = data;

  logger.debug({ uid }, 'createUser: creating user');
  const user = await userStore.createUser({
    uid,
    email,
    role: role ?? DEFAULT_ROLE,
    enable: enable ?? false,
  });
  logger.info({ uid, action: 'createUser' }, 'User created');
  return user;
}

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
 * Updates mutable attributes of a user.
 *
 * @param uid - Unique identifier of the user to update.
 * @param data - Fields to update. Only supplied fields are changed.
 * @returns The updated {@link UserRecord}.
 * @throws {NotFoundError} If no user with that UID exists.
 */
export async function updateUser(uid: string, data: UpdateUserRequest): Promise<UserRecord> {
  if (data.email !== undefined) {
    logger.debug({ uid, email: data.email }, 'updateUser: validating new email');
    validateEmail(data.email);
  }

  logger.debug({ uid }, 'updateUser: updating user');
  const user = await getUserStore().updateUser(uid, data);
  logger.info({ uid, action: 'updateUser' }, 'User updated');
  return user;
}

/**
 * Permanently removes a user.
 *
 * @param uid - Unique identifier of the user to delete.
 * @throws {NotFoundError} If no user with that UID exists.
 */
export async function deleteUser(uid: string): Promise<void> {
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
  const result = await getUserStore().listUsers(maxResults, pageToken, filters);
  logger.debug({ count: result.users.length, hasNextPage: !!result.pageToken }, 'listUsers: query complete');
  return { users: result.users, pageToken: result.pageToken };
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

