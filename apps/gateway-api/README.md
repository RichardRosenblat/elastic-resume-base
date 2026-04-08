# Gateway API

Gateway API service for [Elastic Resume Base](../../README.md). Provides a unified API layer that handles authentication, request validation, and orchestration of downstream microservices.

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
cd apps/gateway-api
npm install

# Copy and configure environment (uses config.yaml, not .env)
cp ../config_example.yaml ../config.yaml
# Edit config.yaml and set values under systems.shared and systems.gateway-api

# Start in development mode (hot-reload)
npm run dev
```

## Running with Docker

```bash
# Build the image from the repository root
docker build -f apps/gateway-api/Dockerfile -t gateway-api .

# Run the container (config.yaml is mounted as a volume)
docker run -p 3000:3000 -v $(pwd)/config.yaml:/app/config.yaml:ro gateway-api
```

## Running with Firebase Emulators

```bash
# Start Firebase emulators (Auth + Firestore + Pub/Sub)
firebase emulators:start

# In a separate terminal, start the Gateway API
cd apps/gateway-api && npm run dev
```

Ensure your `config.yaml` has the emulator hosts set under `systems.shared`:
```yaml
systems:
  shared:
    FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099"
    FIRESTORE_EMULATOR_HOST: "localhost:8080"
```

## API Overview

All `/api/v1/*` routes require a valid Firebase ID token in the `Authorization: Bearer <token>` header. On each request the Gateway API verifies the token and calls the Users API to resolve the user's role and enabled status.

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

### Distributed Tracing

The frontend generates a fresh UUID v4 `x-correlation-id` header for every request it sends to the Gateway API. The Gateway API accepts this ID (or generates one if absent) and propagates it through every downstream service call.

The gateway also resolves GCP Cloud Trace context from the `x-cloud-trace-context` header. The frontend does **not** send this header — it is an internal server-side concern. When absent (as is always the case for frontend-originated requests), the gateway derives a trace context from the correlation ID and emits a `WARN`-level log entry. The resolved trace ID and span ID are included in every log entry and propagated automatically to all downstream service calls via an Axios request interceptor.

All outbound requests to downstream services (Users API, Document Reader, Search, File Generator, Downloader) automatically receive the `x-correlation-id` and `x-cloud-trace-context` headers, with no manual header threading required.

### Endpoints

| Method | Path | Auth Required | Admin Only | Description |
|--------|------|:-------------:|:----------:|-------------|
| `GET` | `/health/live` | No | No | Liveness probe |
| `GET` | `/health/ready` | No | No | Readiness probe |
| `GET` | `/health/downstream` | No | No | Downstream services health status |
| `GET` | `/api/v1/users/me` | Yes | No | Get authenticated user record from users-api |
| `GET` | `/api/v1/users` | Yes | No | List all users (paginated) |
| `GET` | `/api/v1/users/:uid` | Yes | No | Get user by UID |
| `PATCH` | `/api/v1/users/:uid` | Yes | Yes | Update user (`role` and/or `enable`); admin only |
| `DELETE` | `/api/v1/users/:uid` | Yes | Yes | Delete a user |
| `PATCH` | `/api/v1/users/batch` | Yes | Yes | Batch-update multiple users |
| `DELETE` | `/api/v1/users/batch` | Yes | Yes | Batch-delete multiple users |
| `GET` | `/api/v1/users/pre-approve` | Yes | Yes | List or get pre-approved users |
| `POST` | `/api/v1/users/pre-approve` | Yes | Yes | Add a pre-approved user |
| `PATCH` | `/api/v1/users/pre-approve` | Yes | Yes | Update a pre-approved user's role |
| `DELETE` | `/api/v1/users/pre-approve` | Yes | Yes | Remove a pre-approved user |
| `PATCH` | `/api/v1/users/pre-approve/batch` | Yes | Yes | Batch-update multiple pre-approved users |
| `DELETE` | `/api/v1/users/pre-approve/batch` | Yes | Yes | Batch-delete multiple pre-approved users |
| `POST` | `/api/v1/resumes/ingest` | Yes | No | Ingest resumes from a Google Sheet or batch ID |
| `POST` | `/api/v1/resumes/ingest/upload` | Yes | No | Ingest resumes from an uploaded Excel or CSV file |
| `POST` | `/api/v1/resumes/:resumeId/generate` | Yes | No | Trigger a resume file generation job |
| `POST` | `/api/v1/documents/read` | Yes | No | Extract text from a document via Document Reader |
| `POST` | `/api/v1/documents/ocr` | Yes | No | OCR-scan uploaded documents, returns Excel workbook |
| `GET` | `/api/v1/notifications` | Yes | No | Get notifications for the authenticated user |
| `GET` | `/api/v1/notifications/system` | Yes | Yes | Get system-wide notifications (admin only) |
| `PATCH` | `/api/v1/notifications/:id/read` | Yes | No | Mark a notification as read |
| `DELETE` | `/api/v1/notifications/:id` | Yes | No | Delete a notification |
| `GET` | `/api/v1/docs` | No | No | Swagger UI |
| `GET` | `/api/v1/docs.json` | No | No | Swagger JSON spec |

### Downstream Service Health

The gateway tracks the health of all downstream services in an in-memory **service registry**. Each entry records whether the service is currently `live` (reachable at the network layer) and its `temperature` — `warm` if it was seen alive within the configured `DOWNSTREAM_WARM_TTL_MS` window, or `cold` if it has not been contacted for longer than that.

#### How health observation works

Health state is updated in two ways:

1. **Passive observation** — every outbound HTTP request made through the gateway's shared HTTP client automatically calls `observeSuccess` or `observeFailure` on its service key:
   - Any HTTP response, including 4xx and 5xx, marks the service as `live=true` (the service responded at the network layer).
   - Connection-level failures (ECONNREFUSED, ETIMEDOUT, or no response at all) mark the service as `live=false`. The `lastSeenAlive` timestamp is preserved so the previous known-good time is not lost.

2. **Active background probing** — a periodic timer probes every service whose `lastSeenAlive` is older than `DOWNSTREAM_WARM_TTL_MS` by sending a `GET /health/live` request. This is called a **lazy status check**: only services that have gone cold are re-probed, avoiding unnecessary traffic to services that are already warm. The timer interval is controlled by `DOWNSTREAM_HEALTH_REFRESH_INTERVAL_MS`.

On gateway startup, all registered services are probed once concurrently (`initializeRegistry`) before the server starts accepting traffic, so the registry is pre-populated.

#### Temperature semantics

| Temperature | Meaning |
|-------------|---------|
| `warm` | Service was seen alive within the `DOWNSTREAM_WARM_TTL_MS` window (default: 5 minutes). Requests will be routed normally. |
| `cold` | Service has not been seen within the TTL. A cold start or restart may be in progress. The background prober will attempt to re-establish contact. |

The current health snapshot is exposed at `GET /health/downstream`. Responses include `live`, `temperature`, `lastSeenAlive`, and `lastChecked` for every registered downstream service.

## Environment Variables

All configuration is loaded from `config.yaml` (merged from `systems.shared` and `systems.gateway-api`). The following variables are supported:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `FIREBASE_PROJECT_ID` | `demo-elastic-resume-base` | Firebase project ID for token verification |
| `GCP_PROJECT_ID` | `demo-elastic-resume-base` | GCP project ID |
| `USER_API_SERVICE_URL` | `http://localhost:8005` | Base URL for the Users API |
| `INGESTOR_SERVICE_URL` | `http://localhost:8001` | Base URL for the Ingestor service |
| `SEARCH_BASE_SERVICE_URL` | `http://localhost:8002` | Base URL for the Search Base service |
| `FILE_GENERATOR_SERVICE_URL` | `http://localhost:8003` | Base URL for the File Generator service |
| `DOCUMENT_READER_SERVICE_URL` | `http://localhost:8004` | Base URL for the Document Reader service |
| `DLQ_NOTIFIER_SERVICE_URL` | `http://localhost:8007` | Base URL for the DLQ Notifier service |
| `FIRESTORE_EMULATOR_HOST` | — | Firestore emulator host (e.g. `localhost:8080`) |
| `FIREBASE_AUTH_EMULATOR_HOST` | — | Firebase Auth emulator host (e.g. `localhost:9099`) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `LOG_LEVEL` | `info` | Pino log level |
| `REQUEST_TIMEOUT_MS` | `30000` | Downstream request timeout in milliseconds |
| `RATE_LIMIT_MAX` | `1000` | Max requests per time window (global) |
| `RATE_LIMIT_TIME_WINDOW` | `15 minutes` | Rate-limit window duration |
| `API_V1_RATE_LIMIT_MAX` | `1000` | Max requests per time window for `/api/v1` routes |
| `API_V1_RATE_LIMIT_TIME_WINDOW` | `15 minutes` | Rate-limit window for `/api/v1` routes |
| `DOWNSTREAM_WARM_TTL_MS` | `300000` | TTL (ms) for considering a downstream service "warm" |
| `DOWNSTREAM_HEALTH_REFRESH_INTERVAL_MS` | `3600000` | Interval (ms) for re-probing cold downstream services |

## Running Tests

```bash
npm test
```

## Running Lint

```bash
npm run lint
```

