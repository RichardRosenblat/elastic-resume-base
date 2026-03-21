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
export type { UserRepository, CreateUserData, UpdateUserData, UserRecord, ListUsersResult, } from './interfaces/user-repository.js';
export { FirestoreUserRepository } from './repositories/firestore-user-repository.js';
export type { IUserDocumentStore, UserDocument, CreateUserDocumentData, UpdateUserDocumentData, UserDocumentFilters, ListUserDocumentsResult, } from './interfaces/user-document-store.js';
export type { IPreApprovedStore, PreApprovedDocument, CreatePreApprovedData, UpdatePreApprovedData, PreApprovedFilters, } from './interfaces/pre-approved-store.js';
export { FirestoreUserDocumentStore } from './repositories/firestore-user-document-store.js';
export { FirestorePreApprovedStore } from './repositories/firestore-pre-approved-store.js';
//# sourceMappingURL=index.d.ts.map