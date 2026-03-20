/**
 * @module @elastic-resume-base/synapse
 *
 * Synapse provides shared **persistence abstractions** for Elastic Resume Base
 * microservices. It is strictly concerned with api-to-persistence connections.
 *
 * Error classes have moved to the Toolbox shared library. Import them from
 * `../../../shared/Toolbox/src/errors.js` (relative path) instead.
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   FirestoreUserRepository,
 * } from '@elastic-resume-base/synapse';
 * ```
 */

// User repository interface & models
export type {
  UserRepository,
  CreateUserData,
  UpdateUserData,
  UserRecord,
  ListUsersResult,
} from './interfaces/user-repository.js';

// Concrete implementations
export { FirestoreUserRepository } from './repositories/firestore-user-repository.js';
