/**
 * @module @elastic-resume-base/synapse
 *
 * Synapse provides shared database abstractions and error classes for Elastic
 * Resume Base microservices.
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   FirestoreUserRepository,
 *   NotFoundError,
 * } from '@elastic-resume-base/synapse';
 * ```
 */
export { AppError, NotFoundError, UnauthorizedError, ValidationError, ConflictError, ForbiddenError, DownstreamError, isAppError, } from './errors.js';
export type { UserRepository, CreateUserData, UpdateUserData, UserRecord, ListUsersResult, } from './interfaces/user-repository.js';
export { FirestoreUserRepository } from './repositories/firestore-user-repository.js';
//# sourceMappingURL=index.d.ts.map