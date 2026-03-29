# Changelog — @elastic-resume-base/synapse

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-01-01

### Added

**Persistence initialisation**

- `initializePersistence(options: PersistenceOptions)` — initialises the Firebase Admin
  SDK and the Firestore client; must be called once at application startup.
- `terminatePersistence()` — tears down the Firebase Admin SDK; primarily used in tests.
- `PersistenceOptions` type — `{ projectId: string; credential?: admin.credential.Credential }`.

**User repository**

- `UserRepository` interface — CRUD + list operations for user records.
- `FirestoreUserRepository` class — concrete `UserRepository` backed by Firestore
  (`users` collection).
- `UserRecord`, `CreateUserData`, `UpdateUserData`, `ListUsersResult` types.

**User document store**

- `IUserDocumentStore` interface — CRUD + list + filter operations for user documents.
- `FirestoreUserDocumentStore` class — concrete `IUserDocumentStore` backed by Firestore.
- `UserDocument`, `CreateUserDocumentData`, `UpdateUserDocumentData`,
  `UserDocumentFilters`, `ListUserDocumentsResult` types.

**Pre-approved store**

- `IPreApprovedStore` interface — CRUD + list + filter operations for pre-approved user
  records.
- `FirestorePreApprovedStore` class — concrete `IPreApprovedStore` backed by Firestore
  (`pre_approved_users` collection).
- `PreApprovedDocument`, `CreatePreApprovedData`, `UpdatePreApprovedData`,
  `PreApprovedFilters` types.
