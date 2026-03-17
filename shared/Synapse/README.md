# Synapse

A shared library providing **Firestore database abstractions**, **error handling**, and **response formatting** utilities for Elastic Resume Base microservices.

---

## Installation

```bash
npm install @elastic-resume-base/synapse
```

> **Note:** `firebase-admin` is a peer dependency.  Make sure it is installed in your consuming service.

---

## Quick Start

```typescript
import { initializeApp } from 'firebase-admin/app';
import {
  FirestoreUserRepository,
  NotFoundError,
  formatSuccess,
  formatError,
} from '@elastic-resume-base/synapse';

const app = initializeApp();
const userRepo = new FirestoreUserRepository(app);

// Create a user
const user = await userRepo.createUser({
  email: 'alice@example.com',
  password: 'secret',
  displayName: 'Alice',
});

// Format a success response
const response = formatSuccess(user, req.headers['x-request-id']);
res.status(201).json(response);
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

### Response Formatting (`response.ts`)

Provides `formatSuccess` and `formatError` helpers that produce a consistent JSON envelope across all services.

```typescript
import { formatSuccess, formatError } from '@elastic-resume-base/synapse';

// Success
res.status(200).json(formatSuccess(data, correlationId));
// → { success: true, data: {...}, meta: { correlationId, timestamp } }

// Error
res.status(404).json(formatError('NOT_FOUND', 'User not found', correlationId));
// → { success: false, error: { code, message }, meta: { correlationId, timestamp } }
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
