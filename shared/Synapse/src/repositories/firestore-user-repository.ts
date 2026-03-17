import type { auth as FirebaseAuth, app as FirebaseApp } from 'firebase-admin';
import * as admin from 'firebase-admin';
import { NotFoundError, ConflictError } from '../errors.js';
import type {
  UserRepository,
  CreateUserData,
  UpdateUserData,
  UserRecord,
  ListUsersResult,
} from '../interfaces/user-repository.js';


/** Known Firebase Auth error codes used for mapping to domain errors. */
const FIREBASE_USER_NOT_FOUND_MESSAGES = [
  'there is no user record',
  'no user record',
  'user not found',
] as const;

/** Known Firebase Auth error codes for duplicate email / uid conflicts. */
const FIREBASE_DUPLICATE_MESSAGES = ['email already exists', 'uid already exists'] as const;

/**
 * Returns `true` if the given error message indicates a "user not found" condition.
 *
 * @param message - Lowercase error message to check.
 */
function isNotFoundMessage(message: string): boolean {
  return FIREBASE_USER_NOT_FOUND_MESSAGES.some((m) => message.includes(m));
}

/**
 * Returns `true` if the given error message indicates a duplicate-user conflict.
 *
 * @param message - Lowercase error message to check.
 */
function isDuplicateMessage(message: string): boolean {
  return FIREBASE_DUPLICATE_MESSAGES.some((m) => message.includes(m));
}

/**
 * Maps a Firebase Admin `UserRecord` to the library-normalised {@link UserRecord} shape.
 *
 * @param record - Raw Firebase Auth user record.
 */
function mapRecord(record: admin.auth.UserRecord): UserRecord {
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
 * Concrete {@link UserRepository} implementation backed by **Firebase Auth** (Firestore identity
 * layer via the Firebase Admin SDK).
 *
 * All user records are stored inside Firebase Authentication.  Firestore document data
 * (e.g. profile extensions) can be added in a future iteration by composing this class with
 * a Firestore collection reference.
 *
 * ## Swapping to a different database
 *
 * Create a new class that implements {@link UserRepository} and replace usages in your
 * dependency injection root.  No business logic needs to change.
 *
 * @example
 * ```typescript
 * import { initializeApp } from 'firebase-admin/app';
 * import { FirestoreUserRepository } from '@elastic-resume-base/synapse';
 *
 * const app = initializeApp();
 * const userRepo = new FirestoreUserRepository(app);
 *
 * const user = await userRepo.createUser({ email: 'alice@example.com', password: 'secret' });
 * ```
 */
export class FirestoreUserRepository implements UserRepository {
  private readonly _auth: FirebaseAuth.Auth;

  /**
   * @param app - An initialised Firebase Admin {@link FirebaseApp.App} instance.
   */
  constructor(app: FirebaseApp.App) {
    this._auth = admin.auth(app);
  }

  /**
   * Creates a new Firebase Auth user.
   *
   * @param data - User attributes for creation.
   * @returns The newly created {@link UserRecord}.
   * @throws {ConflictError} If the email address is already registered.
   */
  async createUser(data: CreateUserData): Promise<UserRecord> {
    try {
      const record = await this._auth.createUser(data);
      return mapRecord(record);
    } catch (err: unknown) {
      if (err instanceof Error) {
        const lower = err.message.toLowerCase();
        if (isDuplicateMessage(lower)) {
          throw new ConflictError(`A user with email '${data.email}' already exists`);
        }
      }
      throw err;
    }
  }

  /**
   * Retrieves a Firebase Auth user by UID.
   *
   * @param uid - Unique identifier of the user.
   * @returns The corresponding {@link UserRecord}.
   * @throws {NotFoundError} If no user with that UID exists.
   */
  async getUserByUID(uid: string): Promise<UserRecord> {
    try {
      const record = await this._auth.getUser(uid);
      return mapRecord(record);
    } catch (err: unknown) {
      if (err instanceof Error && isNotFoundMessage(err.message.toLowerCase())) {
        throw new NotFoundError(`User '${uid}' not found`);
      }
      throw err;
    }
  }

  /**
   * Updates mutable attributes of a Firebase Auth user.
   *
   * @param uid - Unique identifier of the user to update.
   * @param data - Fields to update.
   * @returns The updated {@link UserRecord}.
   * @throws {NotFoundError} If no user with that UID exists.
   */
  async updateUserByUID(uid: string, data: UpdateUserData): Promise<UserRecord> {
    try {
      const record = await this._auth.updateUser(uid, data);
      return mapRecord(record);
    } catch (err: unknown) {
      if (err instanceof Error && isNotFoundMessage(err.message.toLowerCase())) {
        throw new NotFoundError(`User '${uid}' not found`);
      }
      throw err;
    }
  }

  /**
   * Permanently deletes a Firebase Auth user.
   *
   * @param uid - Unique identifier of the user to delete.
   * @throws {NotFoundError} If no user with that UID exists.
   */
  async deleteUserByUID(uid: string): Promise<void> {
    try {
      await this._auth.deleteUser(uid);
    } catch (err: unknown) {
      if (err instanceof Error && isNotFoundMessage(err.message.toLowerCase())) {
        throw new NotFoundError(`User '${uid}' not found`);
      }
      throw err;
    }
  }

  /**
   * Lists Firebase Auth users with optional pagination.
   *
   * @param maxResults - Maximum number of records to return per page (default: 100).
   * @param pageToken - Opaque pagination token from a previous call.
   * @returns A {@link ListUsersResult} with the page of users and an optional next-page token.
   */
  async listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult> {
    const result = await this._auth.listUsers(maxResults, pageToken);
    return {
      users: result.users.map(mapRecord),
      pageToken: result.pageToken,
    };
  }
}
