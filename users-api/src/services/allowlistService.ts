import { NotFoundError } from '../errors.js';
import type { DocumentData, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import {
  getFirestore as _getFirestore,
  Timestamp as FirestoreTimestamp,
} from 'firebase-admin/firestore';
import { config } from '../config.js';
import type { AllowlistEntry } from '../models/index.js';
import { logger } from '../utils/logger.js';

/** Name of the Firestore collection where allowlist documents are stored. */
const ALLOWLIST_COLLECTION = config.allowlistCollection;

/**
 * Returns the Firestore instance.
 */
function getFirestore(): Firestore {
  return _getFirestore();
}

/**
 * Maps a Firestore document snapshot to an {@link AllowlistEntry}.
 */
function mapDocument(doc: DocumentSnapshot<DocumentData>): AllowlistEntry {
  if (!doc.exists) {
    throw new NotFoundError(`Allowlist entry '${doc.id}' not found`);
  }
  const data = doc.data() as Record<string, unknown>;
  return {
    email: (data['email'] as string) ?? doc.id,
    role: data['role'] as string | undefined,
  };
}

/**
 * Retrieves a single allowlist entry by email address.
 *
 * @param email - The email address to look up (case-insensitive).
 * @returns The {@link AllowlistEntry} if found.
 * @throws {NotFoundError} If no entry exists for the given email.
 */
export async function getAllowlistEntry(email: string): Promise<AllowlistEntry> {
  const normalised = email.toLowerCase();
  logger.debug({ email: normalised }, 'getAllowlistEntry: fetching from Firestore');
  const db = getFirestore();
  const doc = await db.collection(ALLOWLIST_COLLECTION).doc(normalised).get();
  if (!doc.exists) {
    logger.debug({ email: normalised }, 'getAllowlistEntry: entry not found');
    throw new NotFoundError(`No allowlist entry for '${normalised}'`);
  }
  return mapDocument(doc);
}

/**
 * Creates or updates an allowlist entry for the given email.
 * This operation is idempotent — calling it multiple times with the same email
 * will not create duplicates.
 *
 * @param email - Email address to add/update.
 * @param role - Optional role to assign when the user is onboarded.
 * @returns The upserted {@link AllowlistEntry}.
 */
export async function upsertAllowlistEntry(email: string, role?: string): Promise<AllowlistEntry> {
  const normalised = email.toLowerCase();
  logger.debug({ email: normalised, role }, 'upsertAllowlistEntry: upserting entry');
  const db = getFirestore();

  const docData: Record<string, unknown> = {
    email: normalised,
    updatedAt: FirestoreTimestamp.now(),
  };
  if (role !== undefined) {
    docData['role'] = role;
  }

  await db.collection(ALLOWLIST_COLLECTION).doc(normalised).set(docData, { merge: true });
  logger.info({ email: normalised, action: 'upsertAllowlistEntry' }, 'Allowlist entry upserted');

  const doc = await db.collection(ALLOWLIST_COLLECTION).doc(normalised).get();
  return mapDocument(doc);
}

/**
 * Removes an allowlist entry for the given email.
 *
 * @param email - Email address to remove.
 * @throws {NotFoundError} If no entry exists for the given email.
 */
export async function deleteAllowlistEntry(email: string): Promise<void> {
  const normalised = email.toLowerCase();
  logger.debug({ email: normalised }, 'deleteAllowlistEntry: checking existence');
  const db = getFirestore();
  const doc = await db.collection(ALLOWLIST_COLLECTION).doc(normalised).get();
  if (!doc.exists) {
    logger.debug({ email: normalised }, 'deleteAllowlistEntry: entry not found');
    throw new NotFoundError(`No allowlist entry for '${normalised}'`);
  }
  await db.collection(ALLOWLIST_COLLECTION).doc(normalised).delete();
  logger.info({ email: normalised, action: 'deleteAllowlistEntry' }, 'Allowlist entry deleted');
}
