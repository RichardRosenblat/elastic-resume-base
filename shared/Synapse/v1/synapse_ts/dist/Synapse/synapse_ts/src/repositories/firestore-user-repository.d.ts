import type { app as FirebaseApp } from 'firebase-admin';
import type { UserRepository, CreateUserData, UpdateUserData, UserRecord, ListUsersResult } from '../interfaces/user-repository.js';
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
export declare class FirestoreUserRepository implements UserRepository {
    private readonly _auth;
    /**
     * @param app - An initialised Firebase Admin {@link FirebaseApp.App} instance.
     */
    constructor(app: FirebaseApp.App);
    /**
     * Creates a new Firebase Auth user.
     *
     * @param data - User attributes for creation.
     * @returns The newly created {@link UserRecord}.
     * @throws {ConflictError} If the email address is already registered.
     */
    createUser(data: CreateUserData): Promise<UserRecord>;
    /**
     * Retrieves a Firebase Auth user by UID.
     *
     * @param uid - Unique identifier of the user.
     * @returns The corresponding {@link UserRecord}.
     * @throws {NotFoundError} If no user with that UID exists.
     */
    getUserByUID(uid: string): Promise<UserRecord>;
    /**
     * Updates mutable attributes of a Firebase Auth user.
     *
     * @param uid - Unique identifier of the user to update.
     * @param data - Fields to update.
     * @returns The updated {@link UserRecord}.
     * @throws {NotFoundError} If no user with that UID exists.
     */
    updateUserByUID(uid: string, data: UpdateUserData): Promise<UserRecord>;
    /**
     * Permanently deletes a Firebase Auth user.
     *
     * @param uid - Unique identifier of the user to delete.
     * @throws {NotFoundError} If no user with that UID exists.
     */
    deleteUserByUID(uid: string): Promise<void>;
    /**
     * Lists Firebase Auth users with optional pagination.
     *
     * @param maxResults - Maximum number of records to return per page (default: 100).
     * @param pageToken - Opaque pagination token from a previous call.
     * @returns A {@link ListUsersResult} with the page of users and an optional next-page token.
     */
    listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult>;
}
//# sourceMappingURL=firestore-user-repository.d.ts.map