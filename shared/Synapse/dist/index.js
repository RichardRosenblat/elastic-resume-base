/**
 * @module @elastic-resume-base/synapse
 *
 * Synapse is the **sole** persistence layer for Elastic Resume Base
 * microservices. It owns every aspect of the Firebase / Firestore connection —
 * from SDK initialisation through to data-access abstractions — so that
 * consuming services can remain free of any direct `firebase-admin` dependency.
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   initializePersistence,
 *   FirestoreUserDocumentStore,
 * } from '@elastic-resume-base/synapse';
 *
 * // Call once at application startup, before using any store.
 * initializePersistence({ projectId: 'my-project' });
 * ```
 */
export { initializePersistence } from './persistence.js';
// Concrete implementations
export { FirestoreUserRepository } from './repositories/firestore-user-repository.js';
// Concrete Firestore implementations
export { FirestoreUserDocumentStore } from './repositories/firestore-user-document-store.js';
export { FirestorePreApprovedStore } from './repositories/firestore-pre-approved-store.js';
//# sourceMappingURL=index.js.map