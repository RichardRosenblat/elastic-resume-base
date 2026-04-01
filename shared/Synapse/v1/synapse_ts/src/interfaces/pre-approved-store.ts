/** A pre-approved user document. */
export interface PreApprovedDocument {
  email: string;
  role: string;
}

/** Data required to add a pre-approved user. */
export interface CreatePreApprovedData {
  email: string;
  role: string;
}

/** Data for updating a pre-approved user. */
export interface UpdatePreApprovedData {
  role?: string;
}

/** Filters to apply when listing pre-approved users. */
export interface PreApprovedFilters {
  role?: string;
}

/**
 * Abstract interface for pre-approved user persistence operations.
 *
 * Implement this interface to swap the underlying storage layer without
 * changing any business logic that depends on it.
 */
export interface IPreApprovedStore {
  /**
   * Adds a new pre-approved entry to the store.
   *
   * @param data - Pre-approval data containing the email and role to assign.
   * @returns The newly created {@link PreApprovedDocument}.
   * @throws {ConflictError} If a pre-approved entry for this email already exists.
   */
  add(data: CreatePreApprovedData): Promise<PreApprovedDocument>;

  /**
   * Retrieves a pre-approved entry by email address.
   *
   * @param email - The email address to look up (case-insensitive).
   * @returns The matching {@link PreApprovedDocument}, or `null` if not found.
   */
  getByEmail(email: string): Promise<PreApprovedDocument | null>;

  /**
   * Updates the role of an existing pre-approved entry.
   *
   * @param email - The email address of the entry to update (case-insensitive).
   * @param data - Fields to update.
   * @returns The updated {@link PreApprovedDocument}.
   * @throws {NotFoundError} If no pre-approved entry exists for the given email.
   */
  update(email: string, data: UpdatePreApprovedData): Promise<PreApprovedDocument>;

  /**
   * Permanently removes a pre-approved entry.
   *
   * @param email - The email address of the entry to delete (case-insensitive).
   * @throws {NotFoundError} If no pre-approved entry exists for the given email.
   */
  delete(email: string): Promise<void>;

  /**
   * Lists all pre-approved entries, with optional filtering by role.
   *
   * @param filters - Optional filters to narrow the result set.
   * @returns An array of {@link PreApprovedDocument} objects matching the filters.
   */
  list(filters?: PreApprovedFilters): Promise<PreApprovedDocument[]>;
}
