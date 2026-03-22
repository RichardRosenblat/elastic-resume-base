# Users API

A Node.js/TypeScript microservice that manages user records and provides the BFF Authorization Logic for the Elastic Resume Base platform.

## Overview

The Users API:
- Stores user records (including roles) in **Firestore** (via [Synapse](../shared/Synapse/README.md))
- Exposes RESTful CRUD endpoints for user management
- Implements the **BFF Authorization Logic** for determining a user's access level

> **Architecture note:** All Firebase / Firestore interactions are handled exclusively by the [Synapse](../shared/Synapse/README.md) shared library. The Users API has no direct `firebase-admin` dependency; it delegates persistence initialisation and data access entirely to Synapse.

### BFF Authorization Logic

When `bff-gateway` needs to know a user's role, it calls `GET /api/v1/users/role?email=<address>`. The service resolves the role as follows:

1. **If `ADMIN_SHEET_FILE_ID` is set** — Uses [Bugle](../shared/Bugle/README.md) to fetch the list of users with access to the specified Google Drive file.
   - If the user's email appears in that list → role `"admin"` is returned.
   - If the user's email is **not** in the list → `403 Forbidden` (no access).

2. **If `ADMIN_SHEET_FILE_ID` is *not* set** — Queries Firestore directly to look up the user's stored role by email.
   - If the user exists in Firestore → their stored role is returned.
   - If the user is **not** found in Firestore → `403 Forbidden` (no access).

---

## Project Structure

```text
users-api/
├── src/
│   ├── app.ts                    # Express application factory
│   ├── config.ts                 # Zod-validated environment config
│   ├── server.ts                 # Entry point (persistence init via Synapse + HTTP listen)
│   ├── swagger.ts                # Swagger/OpenAPI setup
│   ├── controllers/
│   │   ├── health.controller.ts  # Liveness/readiness probes
│   │   └── users.controller.ts   # HTTP handler layer
│   ├── middleware/
│   │   ├── correlationId.ts      # Attaches x-correlation-id to every request
│   │   ├── errorHandler.ts       # Global Express error handler
│   │   └── requestLogger.ts      # Per-request Pino logging
│   ├── models/
│   │   └── index.ts              # Shared TypeScript interfaces
│   ├── routes/
│   │   ├── index.ts              # Root router
│   │   ├── health.ts             # /health routes
│   │   └── users.ts              # /api/v1/users routes
│   ├── services/
│   │   └── usersService.ts       # Business logic (Firestore + Bugle)
│   └── utils/
│       └── logger.ts             # Pino logger (dev/prod-aware)
└── tests/
    ├── setup.ts
    └── unit/
        ├── controllers/users.test.ts
        └── services/usersService.test.ts
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: `8005`) |
| `NODE_ENV` | No | `development` / `production` / `test` |
| `FIREBASE_PROJECT_ID` | No | Firestore project ID passed to Synapse's `initializePersistence` (default: `demo-elastic-resume-base`) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | No | Base64-encoded or raw JSON service-account key passed to Synapse's `initializePersistence`. Omit to use Application Default Credentials (ADC). Required in production or when using Google Drive integration. |
| `FIRESTORE_EMULATOR_HOST` | No | Set to point Firestore to a local emulator (read automatically by firebase-admin via Synapse) |
| `FIREBASE_AUTH_EMULATOR_HOST` | No | Set to point Firebase Auth to a local emulator (read automatically by firebase-admin via Synapse) |
| `FIRESTORE_USERS_COLLECTION` | No | Firestore collection name for users (default: `users`) |
| `FIRESTORE_PRE_APPROVED_USERS_COLLECTION` | No | Firestore collection name for pre-approved users (default: `pre_approved_users`) |
| `ONBOARDABLE_EMAIL_DOMAINS` | No | Comma-separated email domains that are auto-onboarded with `enable=false` |
| `BOOTSTRAP_ADMIN_USER_EMAIL` | No | Email address pre-approved as admin on startup |
| `LOG_LEVEL` | No | Pino log level (default: `info`) |
| `GCP_PROJECT_ID` | No | GCP project for Cloud Logging (default: `demo-elastic-resume-base`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: `http://localhost:3000`) |

> **Note:** `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are **not** read by users-api config directly — they are picked up automatically by the firebase-admin SDK inside Synapse when set in the process environment.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |
| `GET` | `/api/v1/users` | List users (paginated) |
| `POST` | `/api/v1/users` | Create a new user |
| `GET` | `/api/v1/users/:uid` | Get user by UID |
| `PATCH` | `/api/v1/users/:uid` | Update user by UID |
| `DELETE` | `/api/v1/users/:uid` | Delete user by UID |
| `GET` | `/api/v1/users/role?email=<address>` | BFF access check (returns role or 403) |
| `POST` | `/api/v1/users/roles/batch` | Batch role lookup from Firestore |
| `GET` | `/api/v1/docs` | Swagger UI |
| `GET` | `/api/v1/docs.json` | Swagger JSON spec |

---

## Setup

### Prerequisites

- Node.js 20+
- [Shared Synapse library](../shared/Synapse/README.md) built (`npm run build`) — Synapse owns all Firebase/Firestore connections
- [Shared Bugle library](../shared/Bugle/README.md) built (`npm run build`)
- Firebase project or local Firestore emulator (configured via environment variables, used by Synapse internally)

### Installation

```bash
# Build shared libraries first
cd ../shared/Synapse && npm install && npm run build
cd ../shared/Bugle && npm install && npm run build

# Install users-api dependencies
cd ../../users-api
npm install

# Copy and configure environment variables
cp .env.example .env
```

### Running Locally

```bash
# With Firestore emulator (start emulator first):
export FIRESTORE_EMULATOR_HOST=localhost:8080
npm run dev

# Or with full Docker Compose environment:
cd ..
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

### Test Scenarios for BFF Access Logic

The test suite (`tests/unit/services/usersService.test.ts`) covers all four BFF access scenarios:

1. **Admin via Google Drive** — `ADMIN_SHEET_FILE_ID` is set and the user's email **is** in the Drive permissions list → returns `"admin"`.
2. **Firestore fallback (with access)** — `ADMIN_SHEET_FILE_ID` is **not** set and the user exists in Firestore → returns their stored role.
3. **No access** — `ADMIN_SHEET_FILE_ID` is set but user email is **not** in Drive permissions → returns `null` (maps to HTTP 403).
4. **Firestore fallback (no access)** — `ADMIN_SHEET_FILE_ID` is **not** set and the user is **not** in Firestore → returns `null` (maps to HTTP 403).

---

## Integration with bff-gateway

The `bff-gateway` calls this service via `userApiClient.ts`:

- `GET /api/v1/users/role?email=<address>` → `getUserRoleByEmail(email)`
- `POST /api/v1/users/roles/batch` → `getUserRolesBatch(uids)`

Set the `USER_API_SERVICE_URL` environment variable in `bff-gateway` to point to this service (default: `http://localhost:8005`).

---

## Docker

```bash
# Build from repo root (Dockerfile uses multi-stage build with shared libs)
docker build -f users-api/Dockerfile -t users-api .

# Or use docker-compose:
docker-compose up users-api
```
