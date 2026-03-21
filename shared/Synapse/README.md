# Synapse

Synapse is the **sole persistence layer** for Elastic Resume Base microservices.  It owns *every* aspect of the Firebase / Firestore connection — from SDK initialisation through to data-access abstractions — so that consuming services remain completely free of any direct `firebase-admin` dependency.

Response formatting is handled separately by [Bowltie](../Bowltie/README.md).

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Firebase Admin SDK initialisation | ✅ Synapse (`initializePersistence`) |
| Firestore document access | ✅ Synapse (`FirestoreUserDocumentStore`, `FirestorePreApprovedStore`) |
| Firebase Auth management | ✅ Synapse (`FirestoreUserRepository`) |
| Business logic / HTTP routing | ❌ Consuming service (e.g. `users-api`) |
| Error formatting for HTTP responses | ❌ Bowltie |

---

## Installation

To install Synapse use a relative path to the package since it is not published to npm. From the root of your project, run:

```bash
npm install ../shared/Synapse
```

> **Note:** `firebase-admin` is a **direct** dependency of Synapse and is installed automatically. Consuming services must **not** declare it themselves.

If Synapse hasn't been built yet, build it first:

```bash
cd shared/Synapse
npm install
npm run build
```

Or build all shared packages at once from the monorepo root:

```bash
.\build_shared.bat
```

---

## Quick Start

```typescript
import {
  initializePersistence,
  FirestoreUserDocumentStore,
} from '@elastic-resume-base/synapse';

// 1. Initialise the persistence layer ONCE at application startup.
//    Pass credentials from your service config — no firebase-admin import needed.
initializePersistence({
  projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project',
  serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY, // optional
});

// 2. Create store instances — Firebase is already initialised above.
const userStore = new FirestoreUserDocumentStore('users');

// 3. Use the store.
const user = await userStore.getUserByUid('some-uid');
```

---

## Modules

### Persistence initialisation (`persistence.ts`)

This is the **entry point** every consuming service must call before using any store.

```typescript
import { initializePersistence } from '@elastic-resume-base/synapse';

initializePersistence({
  projectId: 'my-firebase-project',
  serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY, // optional
});
```

`initializePersistence` is **idempotent** — calling it more than once has no effect.

#### `PersistenceOptions`

| Field | Type | Required | Description |
|---|---|---|---|
| `projectId` | `string` | ✅ | Firebase / Firestore project ID |
| `serviceAccountKey` | `string` | ❌ | Raw JSON or Base64-encoded service-account key. Omit to use Application Default Credentials (ADC). |

---

### Error Classes (`errors.ts`)

All errors extend the base `AppError` class which carries a `statusCode` and machine-readable `code`.

| Class               | HTTP Status | Code               |
|---------------------|-------------|--------------------|
| `NotFoundError`     | 404         | `NOT_FOUND`        |
| `UnauthorizedError` | 401         | `UNAUTHORIZED`     |
| `ValidationError`   | 400         | `VALIDATION_ERROR` |
| `ConflictError`     | 409         | `CONFLICT`         |
| `ForbiddenError`    | 403         | `FORBIDDEN`        |
| `DownstreamError`   | 502         | `DOWNSTREAM_ERROR` |

```typescript
import { NotFoundError, isAppError } from '@elastic-resume-base/synapse';

try {
  await userStore.getUserByUid('nonexistent');
} catch (err) {
  if (isAppError(err)) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
  }
}
```

---

### User Document Store (`interfaces/user-document-store.ts`)

The `IUserDocumentStore` interface abstracts all Firestore user-document operations. Services depend on this interface — not on any concrete implementation — so the underlying database can be swapped without touching business logic.

```typescript
interface IUserDocumentStore {
  createUser(data: CreateUserDocumentData): Promise<UserDocument>;
  getUserByUid(uid: string): Promise<UserDocument>;
  getUserByEmail(email: string): Promise<UserDocument | null>;
  updateUser(uid: string, data: UpdateUserDocumentData): Promise<UserDocument>;
  deleteUser(uid: string): Promise<void>;
  listUsers(maxResults?: number, pageToken?: string, filters?: UserDocumentFilters): Promise<ListUserDocumentsResult>;
}
```

**Concrete implementation:** `FirestoreUserDocumentStore(collectionName: string)`

---

### Pre-Approved Store (`interfaces/pre-approved-store.ts`)

The `IPreApprovedStore` interface manages the pre-approved user allowlist.

```typescript
interface IPreApprovedStore {
  add(data: CreatePreApprovedData): Promise<PreApprovedDocument>;
  getByEmail(email: string): Promise<PreApprovedDocument | null>;
  update(email: string, data: UpdatePreApprovedData): Promise<PreApprovedDocument>;
  delete(email: string): Promise<void>;
  list(filters?: PreApprovedFilters): Promise<PreApprovedDocument[]>;
}
```

**Concrete implementation:** `FirestorePreApprovedStore(collectionName: string)`

---

### Firebase Auth User Repository (`interfaces/user-repository.ts`)

The `UserRepository` interface abstracts Firebase Authentication user operations.

```typescript
interface UserRepository {
  createUser(data: CreateUserData): Promise<UserRecord>;
  getUserByUID(uid: string): Promise<UserRecord>;
  updateUserByUID(uid: string, data: UpdateUserData): Promise<UserRecord>;
  deleteUserByUID(uid: string): Promise<void>;
  listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult>;
}
```

**Concrete implementation:** `FirestoreUserRepository(app: FirebaseApp.App)`

---

## Implementing a New Database Layer

1. Create a class that implements the relevant interface (`IUserDocumentStore`, `IPreApprovedStore`, or `UserRepository`).
2. Map provider-specific errors to the Synapse error classes (`NotFoundError`, `ConflictError`, etc.).
3. Register your implementation in the consuming service.

```typescript
import type { IUserDocumentStore, UserDocument } from '@elastic-resume-base/synapse';
import { NotFoundError } from '@elastic-resume-base/synapse';

export class PostgresUserDocumentStore implements IUserDocumentStore {
  async getUserByUid(uid: string): Promise<UserDocument> {
    const row = await db.query('SELECT * FROM users WHERE uid = $1', [uid]);
    if (!row) throw new NotFoundError(`User '${uid}' not found`);
    return mapRow(row);
  }
  // ... implement remaining methods
}
```

The consuming service then calls `initializePersistence` (or its own DB init) once at startup and injects the new store — no business logic changes required.

---

## Development

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript
npm run lint       # Lint source and tests
npm run typecheck  # Type-check without emitting
npm test           # Run unit tests
npm run test:coverage  # Run tests with coverage report
```

---

## License

Internal — Elastic Resume Base project.

