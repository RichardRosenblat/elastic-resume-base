/**
 * Data required to create a new user.
 * Implementations may extend this with provider-specific fields.
 */
export interface CreateUserData {
    readonly email: string;
    readonly password: string;
    readonly displayName?: string;
    readonly photoURL?: string;
    readonly disabled?: boolean;
}
/**
 * Data that may be updated on an existing user.
 * All fields are optional — only supplied fields will be updated.
 */
export interface UpdateUserData {
    readonly email?: string;
    readonly password?: string;
    readonly displayName?: string;
    readonly photoURL?: string;
    readonly disabled?: boolean;
}
/** A normalised user record returned by repository operations. */
export interface UserRecord {
    /** Unique identifier for the user (provider-specific). */
    readonly uid: string;
    readonly email?: string;
    readonly displayName?: string;
    readonly photoURL?: string;
    readonly disabled: boolean;
    readonly emailVerified: boolean;
    /** ISO-8601 timestamp when the user was created. */
    readonly createdAt?: string;
    /** ISO-8601 timestamp of the user's last sign-in. */
    readonly lastLoginAt?: string;
}
/** Paginated response returned by {@link UserRepository.listUsers}. */
export interface ListUsersResult {
    readonly users: readonly UserRecord[];
    /** Opaque token used to fetch the next page of results. */
    readonly pageToken?: string;
}
/**
 * Abstract interface for user persistence operations.
 *
 * Implement this interface to swap the underlying database layer without
 * changing any business logic that depends on it.
 *
 * @example
 * ```typescript
 * // Implement for a new DB provider:
 * class PostgresUserRepository implements UserRepository {
 *   async createUser(data: CreateUserData): Promise<UserRecord> { ... }
 *   // …other methods
 * }
 * ```
 */
export interface UserRepository {
    /**
     * Creates a new user in the underlying data store.
     *
     * @param data - Required user attributes for creation.
     * @returns The newly created {@link UserRecord}.
     * @throws {ValidationError} If the payload violates constraints.
     * @throws {ConflictError} If a user with the same email already exists.
     */
    createUser(data: CreateUserData): Promise<UserRecord>;
    /**
     * Retrieves a user by their unique identifier.
     *
     * @param uid - The unique identifier of the user.
     * @returns The {@link UserRecord} for the given UID.
     * @throws {NotFoundError} If no user with that UID exists.
     */
    getUserByUID(uid: string): Promise<UserRecord>;
    /**
     * Updates mutable attributes of an existing user.
     *
     * @param uid - The unique identifier of the user to update.
     * @param data - Fields to update.  Only supplied fields are changed.
     * @returns The updated {@link UserRecord}.
     * @throws {NotFoundError} If no user with that UID exists.
     * @throws {ValidationError} If the update payload violates constraints.
     */
    updateUserByUID(uid: string, data: UpdateUserData): Promise<UserRecord>;
    /**
     * Permanently removes a user from the data store.
     *
     * @param uid - The unique identifier of the user to delete.
     * @throws {NotFoundError} If no user with that UID exists.
     */
    deleteUserByUID(uid: string): Promise<void>;
    /**
     * Returns a paginated list of users.
     *
     * @param maxResults - Maximum number of users to return per page (default: 100).
     * @param pageToken - Opaque pagination token from a previous call.
     * @returns A {@link ListUsersResult} containing users and an optional next-page token.
     */
    listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult>;
}
//# sourceMappingURL=user-repository.d.ts.map