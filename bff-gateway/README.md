# BFF Gateway

Backend For Frontend (BFF) gateway service for [Elastic Resume Base](../README.md). Provides a unified API layer that handles authentication, request validation, and orchestration of downstream microservices.

## Prerequisites

- **Node.js 20+**
- **npm**
- **Docker** (for containerized deployment)
- **Firebase CLI** (optional, for local emulator support)

## Local Development Setup

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start in development mode (hot-reload)
npm run dev
```

## Running with Docker

```bash
# Build the image
docker build -t bff-gateway .

# Run the container
docker run -p 3000:3000 --env-file .env bff-gateway
```

## Running with Firebase Emulators

```bash
# Start Firebase emulators (Auth + Firestore)
firebase emulators:start

# In a separate terminal, start the BFF Gateway
npm run dev
```

Ensure your `.env` has the emulator hosts set:
```
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
FIRESTORE_EMULATOR_HOST=localhost:8080
```

## API Overview

All `/api/v1/*` routes require a valid Firebase ID token in the `Authorization: Bearer <token>` header.

| Method | Path | Auth Required | Description |
|--------|------|:-------------:|-------------|
| `GET` | `/health/live` | No | Liveness probe |
| `GET` | `/health/ready` | No | Readiness probe |
| `GET` | `/api/v1/me` | Yes | Get authenticated user profile |
| `POST` | `/api/v1/resumes/ingest` | Yes | Trigger resume ingest job |
| `POST` | `/api/v1/resumes/:resumeId/generate` | Yes | Generate resume file |
| `POST` | `/api/v1/search` | Yes | Search resumes |
| `POST` | `/api/v1/documents/read` | Yes | Read/parse a document |

### Request & Response Format

All API responses follow this shape:

```json
{
  "success": true,
  "data": { ... },
  "correlationId": "uuid-v4"
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
  "correlationId": "uuid-v4"
}
```

### Correlation IDs

Pass an `x-correlation-id` request header to trace requests across services. If omitted, one is generated automatically and returned in the response header.

## Running Tests

```bash
npm test
```

## Running Lint

```bash
npm run lint
```
