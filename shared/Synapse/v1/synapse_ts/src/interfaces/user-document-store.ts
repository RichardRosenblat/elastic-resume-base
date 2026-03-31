/** A user document record. */
export interface UserDocument {
  uid: string;
  email: string;
  role: string;
  enable: boolean;
}

/** Data required to create a user document. */
export interface CreateUserDocumentData {
  uid: string;
  email: string;
  role: string;
  enable: boolean;
}

/** Data for updating a user document. All fields are optional. */
export interface UpdateUserDocumentData {
  email?: string;
  role?: string;
  enable?: boolean;
}

/** Filters to apply when listing user documents. */
export interface UserDocumentFilters {
  email?: string;
  role?: string;
  enable?: boolean;
}

/** Paginated list result for user documents. */
export interface ListUserDocumentsResult {
  users: UserDocument[];
  pageToken?: string;
}

/**
 * Abstract interface for user document persistence operations.
 *
 * Implement this interface to swap the underlying storage layer without
 * changing any business logic that depends on it.
 */
export interface IUserDocumentStore {
  /**
   * Creates a new user document in the store.
   *
   * @param data - Required user attributes for creation.
   * @returns The newly created {@link UserDocument}.
   * @throws {ConflictError} If a user document with the same UID already exists.
   */
  createUser(data: CreateUserDocumentData): Promise<UserDocument>;

  /**
   * Retrieves a user document by UID.
   *
   * @param uid - Unique identifier of the user.
   * @returns The matching {@link UserDocument}.
   * @throws {NotFoundError} If no user document exists for the given UID.
   */
  getUserByUid(uid: string): Promise<UserDocument>;

  /**
   * Retrieves a user document by email address.
   *
   * @param email - The email address to look up.
   * @returns The matching {@link UserDocument}, or `null` if not found.
   */
  getUserByEmail(email: string): Promise<UserDocument | null>;

  /**
   * Updates mutable fields of an existing user document.
   *
   * @param uid - Unique identifier of the user to update.
   * @param data - Fields to update. Only supplied fields are changed.
   * @returns The updated {@link UserDocument}.
   * @throws {NotFoundError} If no user document exists for the given UID.
   */
  updateUser(uid: string, data: UpdateUserDocumentData): Promise<UserDocument>;

  /**
   * Permanently removes a user document.
   *
   * @param uid - Unique identifier of the user to delete.
   * @throws {NotFoundError} If no user document exists for the given UID.
   */
  deleteUser(uid: string): Promise<void>;

  /**
   * Lists user documents with optional pagination and field filters.
   *
   * @param maxResults - Maximum number of documents to return (default: 100).
   * @param pageToken - Opaque pagination cursor from a previous call.
   * @param filters - Optional filters to narrow the result set.
   * @returns A {@link ListUserDocumentsResult} with the current page and an optional next-page token.
   */
  listUsers(maxResults?: number, pageToken?: string, filters?: UserDocumentFilters): Promise<ListUserDocumentsResult>;
}
