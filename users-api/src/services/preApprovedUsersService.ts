import { NotFoundError, ValidationError } from '../errors.js';
import {
  FirestorePreApprovedStore,
  type IPreApprovedStore,
} from '@elastic-resume-base/synapse';
import { config } from '../config.js';
import type { AddPreApprovedRequest, PreApprovedFilters, PreApprovedUser, UpdatePreApprovedRequest } from '../models/index.js';
import { logger } from '../utils/logger.js';

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
  const users = await getPreApprovedStore().list(filters);
  logger.debug({ count: users.length }, 'listPreApprovedUsers: query complete');
  return users;
}

/**
 * Adds a user to the pre-approved list.
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
