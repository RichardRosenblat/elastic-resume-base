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
// Concrete implementations
export { FirestoreUserRepository } from './repositories/firestore-user-repository.js';
// Concrete Firestore implementations
export { FirestoreUserDocumentStore } from './repositories/firestore-user-document-store.js';
export { FirestorePreApprovedStore } from './repositories/firestore-pre-approved-store.js';
//# sourceMappingURL=index.js.map