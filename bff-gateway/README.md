# BFF Gateway

Backend For Frontend (BFF) gateway service for [Elastic Resume Base](../README.md). Provides a unified API layer that handles authentication, request validation, and orchestration of downstream microservices.

## Prerequisites

- **Node.js 22+**
- **npm**
- **Docker** (for containerized deployment)
- Shared libraries built — run `build_shared.sh` (Linux/macOS) or `build_shared.bat` (Windows) from the repository root before the first run

## Local Development Setup

```bash
# From the repository root, build shared libraries first (one-time)
./build_shared.sh

# Install dependencies
cd bff-gateway
npm install

# Copy and configure environment (uses config.yaml, not .env)
cp ../config_example.yaml ../config.yaml
# Edit config.yaml and set values under systems.shared and systems.bff-gateway

# Start in development mode (hot-reload)
npm run dev
```

## Running with Docker

```bash
# Build the image from the repository root
docker build -f bff-gateway/Dockerfile -t bff-gateway bff-gateway/

# Run the container (config.yaml is mounted as a volume)
docker run -p 3000:3000 -v $(pwd)/config.yaml:/app/config.yaml:ro bff-gateway
```

## Running with Firebase Emulators

```bash
# Start Firebase emulators (Auth + Firestore + Pub/Sub)
firebase emulators:start

# In a separate terminal, start the BFF Gateway
cd bff-gateway && npm run dev
```

Ensure your `config.yaml` has the emulator hosts set under `systems.shared`:
```yaml
systems:
  shared:
    FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099"
    FIRESTORE_EMULATOR_HOST: "localhost:8080"
```

## API Overview

All `/api/v1/*` routes require a valid Firebase ID token in the `Authorization: Bearer <token>` header. On each request the BFF verifies the token and calls the Users API to resolve the user's role and enabled status.

### Request & Response Format

All API responses follow this shape:

```json
{
  "success": true,
  "data": { },
  "meta": {
    "correlationId": "uuid-v4",
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  },
  "meta": {
    "correlationId": "uuid-v4",
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

### Correlation IDs

Pass an `x-correlation-id` request header to trace requests across services. If omitted, one is generated automatically and returned in the response header.

### Endpoints

| Method | Path | Auth Required | Admin Only | Description |
|--------|------|:-------------:|:----------:|-------------|
| `GET` | `/health/live` | No | No | Liveness probe |
| `GET` | `/health/ready` | No | No | Readiness probe |
| `GET` | `/health/downstream` | No | No | Downstream services health status |
| `GET` | `/api/v1/me` | Yes | No | Get authenticated user profile (uid, email, name, picture, role, enable) |
| `GET` | `/api/v1/users/me` | Yes | No | Get authenticated user record from users-api |
| `PATCH` | `/api/v1/users/me` | Yes | No | Update authenticated user's own email |
| `GET` | `/api/v1/users` | Yes | No | List all users (paginated) |
| `GET` | `/api/v1/users/:uid` | Yes | No | Get user by UID |
| `PATCH` | `/api/v1/users/:uid` | Yes | No* | Update user (admin: any field; self: email only) |
| `DELETE` | `/api/v1/users/:uid` | Yes | Yes | Delete a user |
| `GET` | `/api/v1/users/pre-approve` | Yes | Yes | List or get pre-approved users |
| `POST` | `/api/v1/users/pre-approve` | Yes | Yes | Add a pre-approved user |
| `PATCH` | `/api/v1/users/pre-approve` | Yes | Yes | Update a pre-approved user's role |
| `DELETE` | `/api/v1/users/pre-approve` | Yes | Yes | Remove a pre-approved user |
| `GET` | `/api/v1/docs` | No | No | Swagger UI |
| `GET` | `/api/v1/docs.json` | No | No | Swagger JSON spec |

> \* `PATCH /api/v1/users/:uid` is available to all authenticated users but non-admins can only update their own email. Only admins can update `role` or `enable`.

## Environment Variables

All configuration is loaded from `config.yaml` (merged from `systems.shared` and `systems.bff-gateway`). The following variables are supported:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `FIREBASE_PROJECT_ID` | `demo-elastic-resume-base` | Firebase project ID for token verification |
| `USER_API_SERVICE_URL` | `http://localhost:8005` | Base URL for the Users API |
| `FIRESTORE_EMULATOR_HOST` | — | Firestore emulator host (e.g. `localhost:8080`) |
| `FIREBASE_AUTH_EMULATOR_HOST` | — | Firebase Auth emulator host (e.g. `localhost:9099`) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `LOG_LEVEL` | `info` | Pino log level |
| `REQUEST_TIMEOUT_MS` | `30000` | Downstream request timeout in milliseconds |

## Running Tests

```bash
npm test
```

## Running Lint

```bash
npm run lint
```
