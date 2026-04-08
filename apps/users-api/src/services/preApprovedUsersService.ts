import { ConflictError, NotFoundError, ValidationError } from '../errors.js';
import {
  FirestorePreApprovedStore,
  type IPreApprovedStore,
} from '@elastic-resume-base/synapse';
import { config } from '../config.js';
import { getUserByEmail } from './usersService.js';
import type { AddPreApprovedRequest, PreApprovedFilters, PreApprovedUser, UpdatePreApprovedRequest, BatchDeletePreApprovedResponse, BatchUpdatePreApprovedResponse } from '../models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Returns a sorted copy of the provided pre-approved user list.
 *
 * Sort field and direction are taken from `filters.orderBy` and
 * `filters.orderDirection`.  Defaults to ascending order by `email`.
 * The original array is not mutated.
 *
 * @param users - Unsorted array of pre-approved user records.
 * @param filters - Optional filtering/sorting options.
 * @returns A new array of pre-approved users sorted according to `filters`.
 */
function sortPreApprovedUsers(users: PreApprovedUser[], filters?: PreApprovedFilters): PreApprovedUser[] {
  const orderBy = filters?.orderBy ?? 'email';
  const orderDirection = filters?.orderDirection ?? 'asc';

  const sorted = [...users].sort((left, right) => {
    const result = left[orderBy].localeCompare(right[orderBy], undefined, { sensitivity: 'base' });
    return orderDirection === 'desc' ? -result : result;
  });

  return sorted;
}

// ---------------------------------------------------------------------------
// Store singleton (lazy-initialized on first call)
// ---------------------------------------------------------------------------

let _preApprovedStore: IPreApprovedStore | null = null;

function getPreApprovedStore(): IPreApprovedStore {
  if (!_preApprovedStore) {
    _preApprovedStore = new FirestorePreApprovedStore(config.firestorePreApprovedUsersCollection);
  }
  return _preApprovedStore;
}

/**
 * Resets the store singleton. Intended for use in tests only.
 * @internal
 */
export function _resetStore(): void {
  _preApprovedStore = null;
}

/**
 * Validates that the email field is present and is a non-empty string.
 */
function validateEmail(email: string): void {
  if (!email || !email.includes('@')) {
    throw new ValidationError('A valid email address is required');
  }
}

/**
 * Retrieves a pre-approved user by email.
 *
 * @param email - Email address of the pre-approved user.
 * @returns The corresponding {@link PreApprovedUser}.
 * @throws {NotFoundError} If no pre-approved user with that email exists.
 */
export async function getPreApprovedUser(email: string): Promise<PreApprovedUser> {
  logger.debug({ email }, 'getPreApprovedUser: fetching by email');
  const preApproved = await getPreApprovedStore().getByEmail(email);
  if (!preApproved) {
    throw new NotFoundError(`Pre-approved user with email '${email}' not found`);
  }
  return preApproved;
}

/**
 * Lists all pre-approved users with optional filtering.
 *
 * @param filters - Optional filters (role).
 * @returns An array of {@link PreApprovedUser} records.
 */
export async function listPreApprovedUsers(filters?: PreApprovedFilters): Promise<PreApprovedUser[]> {
  logger.debug({ filters }, 'listPreApprovedUsers: fetching pre-approved users');
  const storeFilters: PreApprovedFilters = {};
  if (filters?.role !== undefined) storeFilters.role = filters.role;
  const finalStoreFilters = Object.keys(storeFilters).length > 0 ? storeFilters : undefined;
  const users = await getPreApprovedStore().list(finalStoreFilters);
  const sortedUsers = sortPreApprovedUsers(users, filters);
  logger.debug({ count: sortedUsers.length }, 'listPreApprovedUsers: query complete');
  return sortedUsers;
}

/**
 * Adds a user to the pre-approved list.
 *
 * @param data - The pre-approval data (email and role).
 * @returns The newly created {@link PreApprovedUser}.
 * @throws {ValidationError} If the email is invalid.
 * @throws {ConflictError} If the email is already pre-approved or already an active user.
 */
export async function addToPreApproved(data: AddPreApprovedRequest): Promise<PreApprovedUser> {
  const { email, role } = data;
  logger.debug({ email }, 'addToPreApproved: validating email');
  validateEmail(email);

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new ConflictError(`User with email '${email}' already exists in the users list`);
  }

  const preApproved = await getPreApprovedStore().add({ email, role });
  logger.info({ email, action: 'addToPreApproved' }, 'Pre-approved user added');
  return preApproved;
}

/**
 * Removes a pre-approved user by email.
 *
 * @param email - Email address of the pre-approved user to remove.
 * @throws {NotFoundError} If no pre-approved user with that email exists.
 */
export async function deleteFromPreApproved(email: string): Promise<void> {
  logger.debug({ email }, 'deleteFromPreApproved: removing pre-approved user');
  await getPreApprovedStore().delete(email);
  logger.info({ email, action: 'deleteFromPreApproved' }, 'Pre-approved user deleted');
}

/**
 * Updates a pre-approved user's role.
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
  logger.debug({ email }, 'updatePreApproved: updating pre-approved user');
  const updated = await getPreApprovedStore().update(email, data);
  logger.info({ email, action: 'updatePreApproved' }, 'Pre-approved user updated');
  return updated;
}

/**
 * Batch-deletes multiple pre-approved users by email.
 * Entries not found are silently skipped.
 *
 * @param emails - Array of email addresses to remove.
 * @returns The number of entries deleted.
 */
export async function batchDeleteFromPreApproved(emails: string[]): Promise<BatchDeletePreApprovedResponse> {
  logger.debug({ count: emails.length }, 'batchDeleteFromPreApproved: removing pre-approved users');
  let deleted = 0;
  await Promise.all(
    emails.map(async (email) => {
      try {
        await getPreApprovedStore().delete(email);
        deleted++;
      } catch {
        // silently skip entries that are not found
      }
    }),
  );
  logger.info({ deleted, action: 'batchDeleteFromPreApproved' }, 'Batch pre-approved delete complete');
  return { deleted };
}

/**
 * Batch-updates the role of multiple pre-approved users.
 * Entries not found are silently skipped.
 *
 * @param emails - Array of email addresses to update.
 * @param data - Fields to update (role).
 * @returns The number of entries updated.
 */
export async function batchUpdatePreApproved(
  emails: string[],
  data: UpdatePreApprovedRequest,
): Promise<BatchUpdatePreApprovedResponse> {
  logger.debug({ count: emails.length }, 'batchUpdatePreApproved: updating pre-approved users');
  let updated = 0;
  await Promise.all(
    emails.map(async (email) => {
      try {
        await getPreApprovedStore().update(email, data);
        updated++;
      } catch {
        // silently skip entries that are not found
      }
    }),
  );
  logger.info({ updated, action: 'batchUpdatePreApproved' }, 'Batch pre-approved update complete');
  return { updated };
}
