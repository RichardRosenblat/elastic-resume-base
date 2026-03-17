# Synapse

A shared library providing **Firestore database abstractions** and **error handling** for Elastic Resume Base microservices. Synapse focuses solely on abstracting persistence — response formatting is handled separately by [Bowltie](../Bowltie/README.md).

---

## Installation

To install synapse you must use a relative path to the package since it is not published to npm. From the root of your project, run:

```bash
npm install ../shared/Synapse
```

> **Note:** `firebase-admin` is a peer dependency. If npm does not automatically install it, you may need to add it manually:

```bash
npm install firebase-admin
```

---

## Quick Start

```typescript
import { initializeApp } from 'firebase-admin/app';
import {
  FirestoreUserRepository,
  NotFoundError,
  isAppError,
} from '@elastic-resume-base/synapse';

const app = initializeApp();
const userRepo = new FirestoreUserRepository(app);

// Retrieve a user — throws NotFoundError if missing
const user = await userRepo.getUserByUID(uid);
```

---

## Modules

### Error Classes (`errors.ts`)

All errors extend the base `AppError` class which carries a `statusCode` and machine-readable `code`.

| Class              | HTTP Status | Code               |
|--------------------|-------------|--------------------|
| `NotFoundError`    | 404         | `NOT_FOUND`        |
| `UnauthorizedError`| 401         | `UNAUTHORIZED`     |
| `ValidationError`  | 400         | `VALIDATION_ERROR` |
| `ConflictError`    | 409         | `CONFLICT`         |
| `ForbiddenError`   | 403         | `FORBIDDEN`        |
| `DownstreamError`  | 502 (default)| `DOWNSTREAM_ERROR`|

```typescript
import { NotFoundError, isAppError } from '@elastic-resume-base/synapse';

try {
  await userRepo.getUserByUID('nonexistent');
} catch (err) {
  if (isAppError(err)) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
  }
}
```

### User Repository Interface (`interfaces/user-repository.ts`)

The `UserRepository` interface abstracts all user persistence operations.  Services depend on this interface — not on any concrete implementation — so the underlying database can be swapped without changing business logic.

```typescript
interface UserRepository {
  createUser(data: CreateUserData): Promise<UserRecord>;
  getUserByUID(uid: string): Promise<UserRecord>;
  updateUserByUID(uid: string, data: UpdateUserData): Promise<UserRecord>;
  deleteUserByUID(uid: string): Promise<void>;
  listUsers(maxResults?: number, pageToken?: string): Promise<ListUsersResult>;
}
```

### Firestore Implementation (`repositories/firestore-user-repository.ts`)

`FirestoreUserRepository` is the production implementation backed by **Firebase Authentication** via the Firebase Admin SDK.

```typescript
import { initializeApp } from 'firebase-admin/app';
import { FirestoreUserRepository } from '@elastic-resume-base/synapse';

const app = initializeApp();
const userRepo = new FirestoreUserRepository(app);
```

---

## Implementing a New Database Layer

1. Create a class that implements the `UserRepository` interface.
2. Map provider-specific errors to the Synapse error classes (`NotFoundError`, `ConflictError`, etc.).
3. Register your implementation in the consuming service's dependency injection root.

```typescript
import type { UserRepository, CreateUserData, UserRecord } from '@elastic-resume-base/synapse';
import { NotFoundError } from '@elastic-resume-base/synapse';

export class PostgresUserRepository implements UserRepository {
  async createUser(data: CreateUserData): Promise<UserRecord> {
    // ... call your SQL layer
  }

  async getUserByUID(uid: string): Promise<UserRecord> {
    const row = await db.query('SELECT * FROM users WHERE uid = $1', [uid]);
    if (!row) throw new NotFoundError(`User '${uid}' not found`);
    return mapRow(row);
  }

  // ... implement remaining methods
}
```

Then swap the implementation without touching any business logic:

```typescript
// Before
const userRepo = new FirestoreUserRepository(app);

// After
const userRepo = new PostgresUserRepository(pgClient);
```

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
