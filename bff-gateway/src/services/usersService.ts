import * as admin from 'firebase-admin';
import { getFirebaseApp } from '../middleware/auth.js';
import { NotFoundError } from '../errors.js';
import { logger } from '../utils/logger.js';
import type { CreateUserRequest, UpdateUserRequest, UserRecord, ListUsersResponse } from '../models/index.js';

/**
 * Maps a Firebase Admin UserRecord to our UserRecord model.
 */
function mapUserRecord(record: admin.auth.UserRecord): UserRecord {
  return {
    uid: record.uid,
    email: record.email,
    displayName: record.displayName,
    photoURL: record.photoURL,
    disabled: record.disabled,
    emailVerified: record.emailVerified,
    createdAt: record.metadata.creationTime,
    lastLoginAt: record.metadata.lastSignInTime,
  };
}

/**
 * Creates a new Firebase Auth user.
 */
export async function createUser(payload: CreateUserRequest): Promise<UserRecord> {
  const app = getFirebaseApp();
  logger.info({ action: 'createUser' }, 'Creating new user');
  const record = await admin.auth(app).createUser(payload);
  return mapUserRecord(record);
}

/**
 * Retrieves a Firebase Auth user by UID.
 */
export async function getUserByUid(uid: string): Promise<UserRecord> {
  const app = getFirebaseApp();
  try {
    const record = await admin.auth(app).getUser(uid);
    return mapUserRecord(record);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes('no user record')) {
      throw new NotFoundError(`User ${uid} not found`);
    }
    throw err;
  }
}

/**
 * Updates a Firebase Auth user by UID.
 */
export async function updateUser(uid: string, payload: UpdateUserRequest): Promise<UserRecord> {
  const app = getFirebaseApp();
  logger.info({ uid, action: 'updateUser' }, 'Updating user');
  const record = await admin.auth(app).updateUser(uid, payload);
  return mapUserRecord(record);
}

/**
 * Deletes a Firebase Auth user by UID.
 */
export async function deleteUser(uid: string): Promise<void> {
  const app = getFirebaseApp();
  logger.info({ uid, action: 'deleteUser' }, 'Deleting user');
  await admin.auth(app).deleteUser(uid);
}

/**
 * Lists Firebase Auth users with optional pagination.
 */
export async function listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResponse> {
  const app = getFirebaseApp();
  const result = await admin.auth(app).listUsers(maxResults, pageToken);
  return {
    users: result.users.map(mapUserRecord),
    pageToken: result.pageToken,
  };
}
