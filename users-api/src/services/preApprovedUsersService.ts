import { ConflictError, NotFoundError, ValidationError } from '../errors.js';
import type { DocumentData, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import { getFirestore as _getFirestore } from 'firebase-admin/firestore';
import { config } from '../config.js';
import type { AddPreApprovedRequest, PreApprovedUser, UpdatePreApprovedRequest } from '../models/index.js';
import { logger } from '../utils/logger.js';

/** Name of the Firestore collection where pre-approved user documents are stored. */
const PRE_APPROVED_COLLECTION = config.firestorePreApprovedUsersCollection;

/**
 * Returns the Firestore instance.
 */
function getFirestore(): Firestore {
  return _getFirestore();
}

/**
 * Maps a Firestore document snapshot to the normalised {@link PreApprovedUser} shape.
 *
 * @param doc - Firestore document snapshot.
 * @returns Normalised PreApprovedUser.
 * @throws {NotFoundError} If the document does not exist.
 */
function mapDocument(doc: DocumentSnapshot<DocumentData>): PreApprovedUser {
  if (!doc.exists) {
    throw new NotFoundError(`Pre-approved user not found`);
  }
  const data = doc.data() as Record<string, unknown>;
  return {
    email: (data['email'] as string) ?? '',
    role: (data['role'] as string) ?? 'user',
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

/**
 * Retrieves a pre-approved user from Firestore by email.
 *
 * @param email - Email address of the pre-approved user.
 * @returns The corresponding {@link PreApprovedUser}.
 * @throws {NotFoundError} If no pre-approved user with that email exists.
 */
export async function getPreApprovedUser(email: string): Promise<PreApprovedUser> {
  logger.debug({ email }, 'getPreApprovedUser: querying pre_approved_users by email');
  const db = getFirestore();
  const snapshot = await db
    .collection(PRE_APPROVED_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    logger.debug({ email }, 'getPreApprovedUser: not found');
    throw new NotFoundError(`Pre-approved user with email '${email}' not found`);
  }

  logger.trace({ email }, 'getPreApprovedUser: found');
  return mapDocument(snapshot.docs[0]!);
}

/**
 * Lists all pre-approved users from Firestore.
 *
 * @returns An array of {@link PreApprovedUser} records.
 */
export async function listPreApprovedUsers(): Promise<PreApprovedUser[]> {
  logger.debug('listPreApprovedUsers: fetching all pre-approved users');
  const db = getFirestore();
  const snapshot = await db.collection(PRE_APPROVED_COLLECTION).get();
  const users = snapshot.docs.map(mapDocument);
  logger.debug({ count: users.length }, 'listPreApprovedUsers: query complete');
  return users;
}

/**
 * Adds a user to the pre-approved users collection.
 *
 * @param data - The pre-approval data (email and role).
 * @returns The newly created {@link PreApprovedUser}.
 * @throws {ValidationError} If the email is invalid.
 * @throws {ConflictError} If the email is already pre-approved.
 */
export async function addToPreApproved(data: AddPreApprovedRequest): Promise<PreApprovedUser> {
  const { email, role } = data;
  logger.debug({ email }, 'addToPreApproved: validating email');
  validateEmail(email);

  const db = getFirestore();

  // Check for duplicate email
  const existing = await db
    .collection(PRE_APPROVED_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!existing.empty) {
    logger.warn({ email }, 'addToPreApproved: email already pre-approved (conflict)');
    throw new ConflictError(`A pre-approved user with email '${email}' already exists`);
  }

  logger.trace({ email, role }, 'addToPreApproved: writing document to Firestore');
  await db.collection(PRE_APPROVED_COLLECTION).add({ email, role });
  logger.info({ email, action: 'addToPreApproved' }, 'Pre-approved user added');

  return { email, role };
}

/**
 * Removes a pre-approved user from Firestore by email.
 *
 * @param email - Email address of the pre-approved user to remove.
 * @throws {NotFoundError} If no pre-approved user with that email exists.
 */
export async function deleteFromPreApproved(email: string): Promise<void> {
  logger.debug({ email }, 'deleteFromPreApproved: querying pre_approved_users by email');
  const db = getFirestore();
  const snapshot = await db
    .collection(PRE_APPROVED_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    logger.debug({ email }, 'deleteFromPreApproved: not found');
    throw new NotFoundError(`Pre-approved user with email '${email}' not found`);
  }

  await snapshot.docs[0]!.ref.delete();
  logger.info({ email, action: 'deleteFromPreApproved' }, 'Pre-approved user deleted');
}

/**
 * Updates a pre-approved user's role in Firestore.
 *
 * @param email - Email address of the pre-approved user to update.
 * @param data - Fields to update.
 * @returns The updated {@link PreApprovedUser}.
 * @throws {NotFoundError} If no pre-approved user with that email exists.
 */
export async function updatePreApproved(
  email: string,
  data: UpdatePreApprovedRequest,
): Promise<PreApprovedUser> {
  logger.debug({ email }, 'updatePreApproved: querying pre_approved_users by email');
  const db = getFirestore();
  const snapshot = await db
    .collection(PRE_APPROVED_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    logger.debug({ email }, 'updatePreApproved: not found');
    throw new NotFoundError(`Pre-approved user with email '${email}' not found`);
  }

  const docRef = snapshot.docs[0]!.ref;
  const updateData: Record<string, unknown> = {};
  if (data.role !== undefined) {
    updateData['role'] = data.role;
  }

  if (Object.keys(updateData).length > 0) {
    logger.trace({ email, fields: Object.keys(updateData) }, 'updatePreApproved: writing update to Firestore');
    await docRef.update(updateData);
    logger.info({ email, action: 'updatePreApproved' }, 'Pre-approved user updated');
  }

  const updated = await docRef.get();
  return mapDocument(updated);
}
