import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { DocumentData, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import {
  getFirestore as _getFirestore,
  Timestamp as FirestoreTimestamp,
} from 'firebase-admin/firestore';
import { config } from '../config.js';
import type {
  AuthorizeRequest,
  AuthorizeResponse,
  CreateUserRequest,
  ListUsersResponse,
  UpdateUserRequest,
  UserRecord,
} from '../models/index.js';
import { logger } from '../utils/logger.js';

/** Name of the Firestore collection where user documents are stored. */
const USERS_COLLECTION = config.firestoreUsersCollection;

/** Name of the Firestore collection where pre-approved user documents are stored. */
const PRE_APPROVED_COLLECTION = config.firestorePreApprovedUsersCollection;

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
    role: (data['role'] as string) ?? DEFAULT_ROLE,
    enable: Boolean(data['enable']),
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
// Authorization Logic
// ---------------------------------------------------------------------------

/**
 * Implements the BFF Authorization Logic.
 *
 * Resolution order:
 * 1. Check `users` collection by uid — if found, return role and enable status.
 * 2. Check `pre_approved_users` collection by email — if found, promote to `users` with enable=true.
 * 3. Check email domain against ALLOWED_EMAIL_DOMAINS — if matched, create in `users` with enable=false.
 * 4. Return 403 if no match.
 *
 * @param request - Object containing uid and email from the Firebase token.
 * @returns The user's role and enable status.
 * @throws {ForbiddenError} If the user is not allowed access.
 */
export async function authorizeUser(request: AuthorizeRequest): Promise<AuthorizeResponse> {
  const { uid, email } = request;
  logger.debug({ uid, email }, 'authorizeUser: starting authorization');

  const db = getFirestore();

  // Step 1: Check users collection by uid
  logger.trace({ uid }, 'authorizeUser: checking users collection');
  const userDoc = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (userDoc.exists) {
    const data = userDoc.data() as Record<string, unknown>;
    const role = (data['role'] as string) ?? DEFAULT_ROLE;
    const enable = Boolean(data['enable']);
    logger.debug({ uid, role, enable }, 'authorizeUser: user found in users collection');
    return { role, enable };
  }

  // Step 2: Check pre_approved_users collection by email
  logger.trace({ email }, 'authorizeUser: checking pre_approved_users collection');
  const preApprovedSnapshot = await db
    .collection(PRE_APPROVED_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!preApprovedSnapshot.empty) {
    const preApprovedDoc = preApprovedSnapshot.docs[0]!;
    const preApprovedData = preApprovedDoc.data() as Record<string, unknown>;
    const role = (preApprovedData['role'] as string) ?? DEFAULT_ROLE;

    logger.info({ uid, email, role }, 'authorizeUser: user found in pre_approved_users, promoting to users');

    // Create user in users collection with enable=true
    await db.collection(USERS_COLLECTION).doc(uid).set({
      email,
      role,
      enable: true,
    });

    // Delete from pre_approved_users
    await preApprovedDoc.ref.delete();

    logger.debug({ uid, email, role }, 'authorizeUser: user promoted successfully');
    return { role, enable: true };
  }

  // Step 3: Check email domain
  const allowedDomains = config.allowedEmailDomains
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  if (allowedDomains.length > 0) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && allowedDomains.includes(domain)) {
      logger.info({ uid, email, domain }, 'authorizeUser: email domain is allowed, creating user with enable=false');

      await db.collection(USERS_COLLECTION).doc(uid).set({
        email,
        role: DEFAULT_ROLE,
        enable: false,
      });

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
 * Creates a new user document in Firestore.
 *
 * @param data - User creation payload.
 * @returns The newly created {@link UserRecord}.
 * @throws {ValidationError} If the email is missing or invalid.
 * @throws {ConflictError} If a user with the same uid already exists.
 */
export async function createUser(data: CreateUserRequest): Promise<UserRecord> {
  logger.debug({ email: data.email }, 'createUser: validating email');
  validateEmail(data.email);

  const db = getFirestore();
  const { uid, email, role, enable } = data;

  // Check if UID already exists
  logger.debug({ uid }, 'createUser: checking for duplicate uid');
  const existingById = await db.collection(USERS_COLLECTION).doc(uid).get();

  if (existingById.exists) {
    logger.warn({ uid }, 'createUser: uid already exists (conflict)');
    throw new ConflictError(`A user with id '${uid}' already exists`);
  }

  const docData: Record<string, unknown> = {
    email,
    role: role ?? DEFAULT_ROLE,
    enable: enable ?? false,
  };

  logger.trace(
    { uid, email, role: docData['role'] },
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
 * @throws {NotFoundError} If no user with that UID exists.
 */
export async function updateUser(uid: string, data: UpdateUserRequest): Promise<UserRecord> {
  const db = getFirestore();

  logger.debug({ uid }, 'updateUser: checking user existence');
  const existing = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!existing.exists) {
    logger.debug({ uid }, 'updateUser: user not found');
    throw new NotFoundError(`User '${uid}' not found`);
  }

  if (data.email !== undefined) {
    logger.debug({ uid, email: data.email }, 'updateUser: validating new email');
    validateEmail(data.email);
  }

  const { email, role, enable } = data;
  const fields = { email, role, enable };

  const updateData: Record<string, unknown> = {
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
  let query = db.collection(USERS_COLLECTION).orderBy('email', 'asc').limit(maxResults);

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
// Bootstrapping and onready functions
// ---------------------------------------------------------------------------

/**
 * Bootstraps the admin user based on the configuration.
 * Adds the admin email to the `pre_approved_users` collection if it does not already exist
 * in either `users` or `pre_approved_users`.
 * @returns A promise that resolves when the admin user has been pre-approved or skipped.
 */
export async function bootstrapAdminUser(): Promise<void> {
  if (!config.bootstrapAdminUserEmail) {
    logger.warn('No bootstrap admin email configured; skipping admin user creation');
    return;
  }

  const email = config.bootstrapAdminUserEmail;
  logger.info({ email }, 'Bootstrapping admin user from configuration email');

  const db = getFirestore();

  // Idempotency check: is there already a user with this email in `users`?
  const usersSnapshot = await db
    .collection(USERS_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!usersSnapshot.empty) {
    logger.info({ email }, 'Admin user already exists in users collection; skipping pre-approval');
    return;
  }

  // Idempotency check: is the email already in `pre_approved_users`?
  const preApprovedSnapshot = await db
    .collection(PRE_APPROVED_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!preApprovedSnapshot.empty) {
    logger.info({ email }, 'Admin email already in pre_approved_users; skipping');
    return;
  }

  // Add to pre_approved_users with admin role
  try {
    await db.collection(PRE_APPROVED_COLLECTION).add({
      email,
      role: 'admin',
    });
    logger.info({ email }, 'Admin email added to pre_approved_users successfully');
  } catch (error) {
    logger.error({ email, error }, 'Error occurred while bootstrapping admin user');
  }
}

