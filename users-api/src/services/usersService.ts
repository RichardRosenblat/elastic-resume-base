import { DrivePermissionsService } from '@elastic-resume-base/bugle';
import { ConflictError, NotFoundError, ValidationError } from '@elastic-resume-base/synapse';
import type { DocumentData, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import {
  getFirestore as _getFirestore,
  Timestamp as FirestoreTimestamp,
} from 'firebase-admin/firestore';
import { config } from '../config.js';
import type {
  CreateUserRequest,
  ListUsersResponse,
  UpdateUserRequest,
  UserRecord,
} from '../models/index.js';
import { logger } from '../utils/logger.js';

/** Name of the Firestore collection where user documents are stored. */
const USERS_COLLECTION = config.firestoreUsersCollection;

/** Default role assigned to newly created users. */
const DEFAULT_ROLE = 'user';

/**
 * Returns the Firestore instance.
 * Uses the modular `firebase-admin/firestore` subpath export, which is the
 * ESM-safe way to obtain Firestore in a `"type":"module"` package.
 * @returns Firestore Admin instance.
 */
function getFirestore(): Firestore {
  return _getFirestore();
}

/**
 * Returns `true` if the given value looks like a Firestore Timestamp
 * (has a callable `toDate` method).
 */
function isTimestamp(value: unknown): value is FirestoreTimestamp {
  return (
    value !== null &&
    value !== undefined &&
    typeof (value as Record<string, unknown>)['toDate'] === 'function'
  );
}

/**
 * Maps a Firestore document snapshot to the normalised {@link UserRecord} shape.
 *
 * @param doc - Firestore document snapshot.
 * @returns Normalised UserRecord.
 * @throws {NotFoundError} If the document does not exist.
 */
function mapDocument(doc: DocumentSnapshot<DocumentData>): UserRecord {
  if (!doc.exists) {
    throw new NotFoundError(`User '${doc.id}' not found`);
  }
  const data = doc.data() as Record<string, unknown>;
  return {
    uid: doc.id,
    email: (data['email'] as string) ?? '',
    displayName: data['displayName'] as string | undefined,
    photoURL: data['photoURL'] as string | undefined,
    role: (data['role'] as string) ?? DEFAULT_ROLE,
    disabled: Boolean(data['disabled']),
    createdAt: isTimestamp(data['createdAt'])
      ? data['createdAt'].toDate().toISOString()
      : (data['createdAt'] as string | undefined),
    updatedAt: isTimestamp(data['updatedAt'])
      ? data['updatedAt'].toDate().toISOString()
      : (data['updatedAt'] as string | undefined),
  };
}

/**
 * Validates that the email field is present and is a non-empty string.
 *
 * @param email - Email value to validate.
 * @throws {ValidationError} If the email is missing or blank.
 */
function validateEmail(email: string): void {
  if (!email || !email.includes('@')) {
    throw new ValidationError('A valid email address is required');
  }
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Creates a new user document in Firestore.
 *
 * @param data - User creation payload.
 * @returns The newly created {@link UserRecord}.
 * @throws {ValidationError} If the email is missing or invalid.
 * @throws {ConflictError} If a user with the same email or ID already exists.
 */
export async function createUser(data: CreateUserRequest): Promise<UserRecord> {
  logger.debug({ email: data.email }, 'createUser: validating email');
  validateEmail(data.email);

  const db = getFirestore();

  logger.debug({ email: data.email }, 'createUser: checking for duplicate email');
  // Check for duplicate email
  const existing = await db
    .collection(USERS_COLLECTION)
    .where('email', '==', data.email)
    .limit(1)
    .get();

  if (!existing.empty) {
    logger.warn({ email: data.email }, 'createUser: email already exists (conflict)');
    throw new ConflictError(`A user with email '${data.email}' already exists`);
  }

  const uid = data.uid ?? db.collection(USERS_COLLECTION).doc().id;

  // Check if UID already exists
  logger.debug({ uid }, 'createUser: checking for duplicate uid');
  const existingById = await db.collection(USERS_COLLECTION).doc(uid).get();

  if (existingById.exists) {
    logger.warn({ uid }, 'createUser: uid already exists (conflict)');
    throw new ConflictError(`A user with id '${uid}' already exists`);
  }

  const now = FirestoreTimestamp.now();

  const docData: Record<string, unknown> = {
    email: data.email,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    role: data.role ?? DEFAULT_ROLE,
    disabled: data.disabled ?? false,
    createdAt: now,
    updatedAt: now,
  };

  logger.trace(
    { uid, email: data.email, role: docData['role'] },
    'createUser: writing document to Firestore',
  );
  await db.collection(USERS_COLLECTION).doc(uid).set(docData);
  logger.info({ uid, action: 'createUser' }, 'User created');

  return mapDocument(await db.collection(USERS_COLLECTION).doc(uid).get());
}

/**
 * Retrieves a user document from Firestore by UID.
 *
 * @param uid - Unique identifier of the user.
 * @returns The corresponding {@link UserRecord}.
 * @throws {NotFoundError} If no user with that UID exists.
 */
export async function getUserByUid(uid: string): Promise<UserRecord> {
  logger.debug({ uid }, 'getUserByUid: fetching document from Firestore');
  const db = getFirestore();
  const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!doc.exists) {
    logger.debug({ uid }, 'getUserByUid: document not found');
  } else {
    logger.trace({ uid }, 'getUserByUid: document retrieved');
  }
  return mapDocument(doc);
}

/**
 * Updates mutable attributes of a Firestore user document.
 *
 * @param uid - Unique identifier of the user to update.
 * @param data - Fields to update. Only supplied fields are changed.
 * @returns The updated {@link UserRecord}.
 * @throws {ValidationError} If an updated email is invalid.
 * @throws {NotFoundError} If no user with that UID exists.
 * @throws {ConflictError} If the new email is already taken by another user.
 */
export async function updateUser(uid: string, data: UpdateUserRequest): Promise<UserRecord> {
  const db = getFirestore();

  logger.debug({ uid }, 'updateUser: checking user existence');
  // Ensure the user exists
  const existing = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!existing.exists) {
    logger.debug({ uid }, 'updateUser: user not found');
    throw new NotFoundError(`User '${uid}' not found`);
  }

  if (data.email !== undefined) {
    logger.debug({ uid, email: data.email }, 'updateUser: validating new email');
    validateEmail(data.email);
    // Check that the new email is not taken by a *different* user
    logger.debug({ uid, email: data.email }, 'updateUser: checking email uniqueness');
    const emailConflict = await db
      .collection(USERS_COLLECTION)
      .where('email', '==', data.email)
      .limit(1)
      .get();

    if (!emailConflict.empty && emailConflict.docs[0]?.id !== uid) {
      logger.warn({ uid, email: data.email }, 'updateUser: email already taken by another user');
      throw new ConflictError(`A user with email '${data.email}' already exists`);
    }
  }

  const { email, displayName, photoURL, role, disabled } = data;
  const fields = { email, displayName, photoURL, role, disabled };

  const updateData: Record<string, unknown> = {
    updatedAt: FirestoreTimestamp.now(),
    // Filter out undefined values and merge
    ...Object.fromEntries(Object.entries(fields).filter(([_, v]) => v !== undefined)),
  };

  logger.trace({ uid, fields: Object.keys(updateData) }, 'updateUser: writing update to Firestore');
  await db.collection(USERS_COLLECTION).doc(uid).update(updateData);
  logger.info({ uid, action: 'updateUser' }, 'User updated');

  return mapDocument(await db.collection(USERS_COLLECTION).doc(uid).get());
}

/**
 * Permanently removes a user document from Firestore.
 *
 * @param uid - Unique identifier of the user to delete.
 * @throws {NotFoundError} If no user with that UID exists.
 */
export async function deleteUser(uid: string): Promise<void> {
  const db = getFirestore();
  logger.debug({ uid }, 'deleteUser: checking user existence before delete');
  const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!doc.exists) {
    logger.debug({ uid }, 'deleteUser: user not found');
    throw new NotFoundError(`User '${uid}' not found`);
  }
  logger.trace({ uid }, 'deleteUser: removing document from Firestore');
  await db.collection(USERS_COLLECTION).doc(uid).delete();
  logger.info({ uid, action: 'deleteUser' }, 'User deleted');
}

/**
 * Lists user documents from Firestore with optional pagination.
 *
 * @param maxResults - Maximum number of results to return (default: 100).
 * @param pageToken - Opaque pagination token (base64-encoded last document UID) from a
 *   previous call. When provided, results begin after the document with that UID.
 * @returns A {@link ListUsersResponse} with the page of users and an optional next-page token.
 */
export async function listUsers(maxResults = 100, pageToken?: string): Promise<ListUsersResponse> {
  logger.debug({ maxResults, hasPageToken: !!pageToken }, 'listUsers: building Firestore query');
  const db = getFirestore();
  let query = db.collection(USERS_COLLECTION).orderBy('createdAt', 'desc').limit(maxResults);

  if (pageToken) {
    logger.trace({ pageToken }, 'listUsers: resolving pagination cursor');
    const lastUid = Buffer.from(pageToken, 'base64').toString('utf-8');
    const lastDoc = await db.collection(USERS_COLLECTION).doc(lastUid).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    } else {
      logger.warn(
        { pageToken, lastUid },
        'listUsers: pagination cursor document not found; starting from beginning',
      );
    }
  }

  logger.trace({ maxResults }, 'listUsers: executing Firestore query');
  const snapshot = await query.get();
  const users = snapshot.docs.map(mapDocument);

  let nextPageToken: string | undefined;
  if (snapshot.docs.length === maxResults) {
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (lastDoc) {
      nextPageToken = Buffer.from(lastDoc.id, 'utf-8').toString('base64');
    }
  }

  logger.debug({ count: users.length, hasNextPage: !!nextPageToken }, 'listUsers: query complete');
  return { users, pageToken: nextPageToken };
}

// ---------------------------------------------------------------------------
// BFF access / role check
// ---------------------------------------------------------------------------

/**
 * Determines the access role for a given user, implementing the BFF Authorization Logic.
 *
 * The resolution order is:
 * 1. **Google Drive (Bugle)** — when `ADMIN_SHEET_FILE_ID` is set, the service retrieves the
 *    list of users with access to that file.  If the user's email appears in the list, the
 *    role `"admin"` is returned.  If the email is *not* in the list, `null` is returned
 *    (no access).
 * 2. **Firestore (Synapse)** — when `ADMIN_SHEET_FILE_ID` is *not* set, the service looks up
 *    the user by UID in Firestore.  If found, the stored role is returned.  If not found,
 *    `null` is returned (no access).
 *
 * @param uid - Firebase user UID (used for the Firestore lookup path).
 * @returns The user's role string (e.g. `"admin"`, `"user"`) or `null` when the user has
 *   no access to the application.
 */
export async function getUserRole(uid: string): Promise<string | null> {
  const adminSheetFileId = config.adminSheetFileId;

  if (adminSheetFileId) {
    // --- Google Drive path (Bugle) ---
    logger.info({ uid, action: 'getUserRole' }, 'Checking access via Google Drive');

    // Look up the user's email from Firestore to use in the Drive check
    let userEmail: string | undefined;
    try {
      const user = await getUserByUid(uid);
      userEmail = user.email;
    } catch {
      // User not in Firestore; we still need to check Drive by email if provided
      logger.warn({ uid }, 'User not found in Firestore; cannot determine email for Drive check');
      return null;
    }

    if (!userEmail) {
      return null;
    }

    const driveService = new DrivePermissionsService();
    const emailsWithAccess = await driveService.getUsersWithFileAccess(adminSheetFileId);
    const normalizedEmail = userEmail.toLowerCase();

    if (emailsWithAccess.includes(normalizedEmail)) {
      logger.info({ uid, email: normalizedEmail }, 'User granted admin access via Google Drive');
      return 'admin';
    }

    logger.info({ uid, email: normalizedEmail }, 'User not found in Drive permissions; no access');
    return null;
  }

  // --- Firestore path (Synapse) ---
  logger.info({ uid, action: 'getUserRole' }, 'Checking access via Firestore');
  try {
    const user = await getUserByUid(uid);
    logger.info({ uid, role: user.role }, 'User found in Firestore');
    return user.role;
  } catch {
    logger.info({ uid }, 'User not found in Firestore; no access');
    return null;
  }
}

/**
 * Retrieves roles for a batch of user UIDs from Firestore.
 *
 * This method always uses the Firestore data store (not the Drive/Bugle path) and is
 * intended for quickly enriching a list of existing users with their stored roles.
 *
 * @param uids - Array of Firebase user UIDs.
 * @returns A map of `uid → role` for every UID in the input array.
 *   UIDs that are not found in Firestore are included with the default role (`"user"`). If a user document exists but has no `role` field, the default role (`"user"`) is also returned for that UID.
 */
export async function getUserRolesBatch(uids: string[]): Promise<Record<string, string>> {
  if (uids.length === 0) {
    logger.debug('getUserRolesBatch: empty input, returning empty result');
    return {};
  }

  logger.debug({ count: uids.length }, 'getUserRolesBatch: fetching roles from Firestore');
  const db = getFirestore();
  const refs = uids.map((uid) => db.collection(USERS_COLLECTION).doc(uid));
  const docs = await db.getAll(...refs);

  const result: Record<string, string> = {};
  let foundCount = 0;
  let notFoundCount = 0;

  for (const doc of docs) {
    if (doc.exists) {
      const data = doc.data() as Record<string, unknown>;
      result[doc.id] = (data['role'] as string) ?? DEFAULT_ROLE;
      foundCount++;
    } else {
      result[doc.id] = DEFAULT_ROLE;
      notFoundCount++;
      logger.trace({ uid: doc.id }, 'getUserRolesBatch: UID not found in Firestore, using default role');
    }
  }

  logger.debug(
    { total: uids.length, found: foundCount, not_found: notFoundCount },
    'getUserRolesBatch: roles resolved',
  );
  return result;
}

// ---------------------------------------------------------------------------
// Bootstrapping and onready functions
// ---------------------------------------------------------------------------


/**
 * Bootstraps the admin user based on the configuration.
 * If the `bootstrapAdminUserEmail` is not set, the function will log a warning and return.
 * @returns A promise that resolves when the admin user has been created or skipped.
 */
export async function bootstrapAdminUser(): Promise<void> {
  if (!config.bootstrapAdminUserEmail) {
    logger.warn('No bootstrap admin email configured; skipping admin user creation');
    return;
  }

  logger.info(
    { email: config.bootstrapAdminUserEmail },
    'Bootstrapping admin user from configuration email',
  );

  await createUser({
    email: config.bootstrapAdminUserEmail,
    role: 'admin',
    displayName: 'Admin User',
    disabled: false,
  });
}
