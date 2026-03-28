# Users API

A Node.js/TypeScript microservice that manages user records and implements the BFF Authorization Logic for the Elastic Resume Base platform.

## Overview

The Users API:
- Stores user records (uid, email, role, enable) in **Firestore** (via [Synapse](../shared/Synapse/README.md))
- Exposes RESTful CRUD endpoints for user management
- Implements the **BFF Authorization Logic** via `POST /api/v1/users/authorize`
- Manages a `pre_approved_users` collection for admin-controlled user onboarding
- Supports auto-onboarding of users from configurable email domains or explicit addresses (`AUTO_USER_CREATION_DOMAINS`, `AUTO_ADMIN_CREATION_DOMAINS`)

> **Architecture note:** All Firebase / Firestore interactions are handled exclusively by the [Synapse](../shared/Synapse/README.md) shared library. The Users API has no direct `firebase-admin` dependency; it delegates persistence initialisation and data access entirely to Synapse.

### BFF Authorization Logic

When `bff-gateway` needs to authorize a user, it calls `POST /api/v1/users/authorize` with `{ uid, email }`. The service resolves authorization as follows:

1. **Look up by UID in the `users` collection** — if found, return `{ role, enable }`.
2. **Look up by email in the `pre_approved_users` collection** — if found, create a new user record (with `enable: true`), remove from pre-approved, and return `{ role, enable: true }`.
3. **Check `AUTO_ADMIN_CREATION_DOMAINS`** — if the email or domain matches, create a new user record (with `role: 'admin'`, `enable: true`) and return immediately.
4. **Check `AUTO_USER_CREATION_DOMAINS`** — if the email or domain matches, create a new user record (with `role: 'user'`, `enable: false`) and return immediately. Falls back to the legacy `ONBOARDABLE_EMAIL_DOMAINS` value when `AUTO_USER_CREATION_DOMAINS` is not set.
5. **Otherwise** — return `403 Forbidden`.

> **Note:** Users created via `AUTO_USER_CREATION_DOMAINS` (`enable: false`) require an admin to set `enable: true` (via `PATCH /api/v1/users/:uid`) before they can access protected routes. Users created via `AUTO_ADMIN_CREATION_DOMAINS` or promoted from the pre-approved list are immediately active (`enable: true`).

---

## Project Structure

```text
users-api/
├── src/
│   ├── app.ts                         # Fastify application factory
│   ├── config.ts                      # Zod-validated environment config
│   ├── server.ts                      # Entry point (Synapse init + HTTP listen)
│   ├── swagger.ts                     # Swagger/OpenAPI setup
│   ├── errors.ts                      # Re-exports from shared/Toolbox
│   ├── controllers/
│   │   ├── health.controller.ts       # Liveness/readiness probes
│   │   └── users.controller.ts        # HTTP handler layer
│   ├── middleware/
│   │   ├── correlationId.ts           # Attaches x-correlation-id to every request
│   │   ├── errorHandler.ts            # Global Fastify error handler
│   │   └── requestLogger.ts           # Per-request Pino logging
│   ├── models/
│   │   └── index.ts                   # Shared TypeScript interfaces
│   ├── routes/
│   │   ├── index.ts                   # Root router
│   │   ├── health.ts                  # /health routes
│   │   └── users.ts                   # /api/v1/users routes
│   ├── services/
│   │   ├── usersService.ts            # User CRUD + authorization logic
│   │   └── preApprovedUsersService.ts # Pre-approval management
│   └── utils/
│       └── logger.ts                  # Pino logger (dev/prod-aware)
└── tests/
    ├── setup.ts
    └── unit/
        ├── controllers/users.test.ts
        └── services/
            ├── usersService.test.ts
            └── preApprovedUsersService.test.ts
```

---

## Environment Variables

All configuration is loaded from `config.yaml` (merged from `systems.shared` and `systems.users-api`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8005` | HTTP port |
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |
| `FIREBASE_PROJECT_ID` | No | `demo-elastic-resume-base` | Firestore project ID passed to Synapse's `initializePersistence` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | No | — | Base64-encoded or raw JSON service-account key for Synapse. Omit to use Application Default Credentials (ADC). Required in production. |
| `FIRESTORE_EMULATOR_HOST` | No | — | Set to point Firestore to a local emulator (read automatically by firebase-admin via Synapse) |
| `FIREBASE_AUTH_EMULATOR_HOST` | No | — | Set to point Firebase Auth to a local emulator (read automatically by firebase-admin via Synapse) |
| `FIRESTORE_USERS_COLLECTION` | No | `users` | Firestore collection name for user records |
| `FIRESTORE_PRE_APPROVED_USERS_COLLECTION` | No | `pre_approved_users` | Firestore collection name for pre-approved users |
| `AUTO_ADMIN_CREATION_DOMAINS` | No | — | Comma-separated list of domains and/or explicit emails whose users are automatically created with `role=admin` and `enable=true`. Set to an empty string to disable admin auto-creation entirely. |
| `AUTO_USER_CREATION_DOMAINS` | No | — | Comma-separated list of domains and/or explicit emails whose users are automatically created with `role=user` and `enable=false`. Set to an empty string to disable user auto-creation entirely. When not set, falls back to `ONBOARDABLE_EMAIL_DOMAINS`. |
| `ONBOARDABLE_EMAIL_DOMAINS` | No | — | **Deprecated** — use `AUTO_USER_CREATION_DOMAINS` instead. Comma-separated email domains auto-onboarded with `enable=false`. Ignored when `AUTO_USER_CREATION_DOMAINS` is set. |
| `BOOTSTRAP_ADMIN_USER_EMAIL` | No | — | Email address pre-approved as admin on startup (idempotent) |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `GCP_PROJECT_ID` | No | `demo-elastic-resume-base` | GCP project for Cloud Logging |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS origins |

> **Note:** `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are not read by users-api config directly — they are picked up automatically by the firebase-admin SDK inside Synapse when set in the process environment.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |
| `POST` | `/api/v1/users/authorize` | BFF authorization check — returns `{ role, enable }` or 403 |
| `GET` | `/api/v1/users` | List users (paginated, supports `role`/`enable` filters) |
| `GET` | `/api/v1/users/:uid` | Get user by UID |
| `PATCH` | `/api/v1/users/:uid` | Update user by UID (email, role, enable) |
| `DELETE` | `/api/v1/users/:uid` | Delete user by UID |
| `GET` | `/api/v1/users/pre-approve` | List or get pre-approved users |
| `POST` | `/api/v1/users/pre-approve` | Add a pre-approved user |
| `PATCH` | `/api/v1/users/pre-approve` | Update a pre-approved user's role |
| `DELETE` | `/api/v1/users/pre-approve` | Remove a pre-approved user |
| `GET` | `/api/v1/docs` | Swagger UI |
| `GET` | `/api/v1/docs.json` | Swagger JSON spec |

---

## Setup

### Prerequisites

- Node.js 22+
- Shared libraries built — run `build_shared.sh` (Linux/macOS) or `build_shared.bat` (Windows) from the repository root
- Firebase project or local Firestore emulator (configured via `config.yaml`, used by Synapse internally)

### Installation

```bash
# Build shared libraries first (from repository root)
./build_shared.sh

# Install users-api dependencies
cd users-api
npm install

# Copy and configure environment (uses config.yaml, not .env)
cp ../config_example.yaml ../config.yaml
# Edit config.yaml with your values
```

### Running Locally

```bash
# With Firestore emulator (start emulator first):
cd users-api && npm run dev

# Or with full Docker Compose environment (from repository root):
docker-compose up
```

### Build

```bash
npm run build
```

---

## Testing

```bash
npm test
# With coverage:
npm run test:coverage
```

### Test Coverage

The test suite covers the authorization scenarios in `usersService.authorizeUser`:

1. **Existing active user** — UID found in `users` collection with `enable: true` → returns `{ role, enable: true }`.
2. **Existing pending user** — UID found in `users` collection with `enable: false` → returns `{ role, enable: false }`.
3. **Pre-approved user** — UID not found but email is in `pre_approved_users` → creates user with `enable: true`, removes from pre-approved list, returns `{ role, enable: true }`.
4. **Auto-admin creation** — email/domain matches `AUTO_ADMIN_CREATION_DOMAINS` → creates admin user with `role: 'admin', enable: true`.
5. **Auto-user creation** — email/domain matches `AUTO_USER_CREATION_DOMAINS` (or legacy `ONBOARDABLE_EMAIL_DOMAINS`) → creates user with `role: 'user', enable: false`.
6. **No access** — UID, email, and domain all unrecognized → throws `ForbiddenError` → HTTP 403.

---

## Integration with bff-gateway

The `bff-gateway` calls this service via `userApiClient.ts`:

- `POST /api/v1/users/authorize` — called on every authenticated request to verify access and obtain `{ role, enable }`

Set the `USER_API_SERVICE_URL` environment variable in `bff-gateway` to point to this service (default: `http://localhost:8005`).

---

## Docker

```bash
# Build from repo root (Dockerfile uses multi-stage build with shared libs)
docker build -f users-api/Dockerfile -t users-api .

# Or use docker-compose:
docker-compose up users-api
```
