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

// ---------------------------------------------------------------------------
// Persistence initialisation (must be called before using any store)
// ---------------------------------------------------------------------------
export type { PersistenceOptions } from './persistence.js';
export { initializePersistence } from './persistence.js';

// ---------------------------------------------------------------------------
// User repository interface & models
// ---------------------------------------------------------------------------
export type {
  UserRepository,
  CreateUserData,
  UpdateUserData,
  UserRecord,
  ListUsersResult,
} from './interfaces/user-repository.js';

// Concrete implementations
export { FirestoreUserRepository } from './repositories/firestore-user-repository.js';

// User document store interface & models
export type {
  IUserDocumentStore,
  UserDocument,
  CreateUserDocumentData,
  UpdateUserDocumentData,
  UserDocumentFilters,
  ListUserDocumentsResult,
} from './interfaces/user-document-store.js';

// Pre-approved store interface & models
export type {
  IPreApprovedStore,
  PreApprovedDocument,
  CreatePreApprovedData,
  UpdatePreApprovedData,
  PreApprovedFilters,
} from './interfaces/pre-approved-store.js';

// Concrete Firestore implementations
export { FirestoreUserDocumentStore } from './repositories/firestore-user-document-store.js';
export { FirestorePreApprovedStore } from './repositories/firestore-pre-approved-store.js';
