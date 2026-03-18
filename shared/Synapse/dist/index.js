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
// Error classes
export { AppError, NotFoundError, UnauthorizedError, ValidationError, ConflictError, ForbiddenError, DownstreamError, isAppError, } from './errors.js';
// Concrete implementations
export { FirestoreUserRepository } from './repositories/firestore-user-repository.js';
//# sourceMappingURL=index.js.map