# Services Overview

This document describes each service and component in the Elastic Resume Base platform. For the current implementation status of each service, see the [README](../README.md#implementation-status).

---

## Implemented Services

### Frontend SPA (✅ Implemented)

A React + TypeScript single-page application that serves as the user interface for the platform. Hosted on Firebase Hosting (or served via the Docker Compose stack during local development).

- Authenticates users with Firebase Auth (email/password and Google SSO)
- Calls the Gateway for all API interactions; never communicates directly with microservices
- Enforces role-based access: admin-only pages (`/users`) are guarded at the routing level
- Feature flags driven by `VITE_FEATURE_*` environment variables allow progressive rollout of backend features
- Supports English, Portuguese (Brazil), and Spanish via i18next
- Responsive layout built with Material UI (MUI) v7

See [apps/frontend/README.md](../apps/frontend/README.md) for environment variables, setup instructions, and development guide.

### Gateway API (✅ Implemented)

Backend For Frontend service responsible for handling requests from the frontend and communicating with backend services. Hosted on Cloud Run (while at low usage, minimum instances can be set to 0; higher-performance options can be enabled as needed).

- Verifies Firebase ID tokens on every authenticated request
- Calls Users API to resolve the user's role and `enable` status
- Enforces role-based access control (RBAC) on protected routes
- Routes requests to downstream microservices

See [apps/gateway-api/README.md](../apps/gateway-api/README.md) for API documentation.

### Users API (✅ Implemented)

A Node.js/TypeScript microservice that manages user records and implements the Gateway Authorization Logic for the platform. Hosted on Cloud Run, minimum instance set to 0, activated through API calls from the Gateway API.

- Stores user records (uid, email, role, enable) in Firestore via Synapse
- Exposes a `POST /api/v1/users/authorize` endpoint called by the Gateway API during every login
- Manages a `pre_approved_users` collection for admin-controlled user onboarding
- Supports auto-onboarding of users from configurable email domains

See [apps/users-api/README.md](../apps/users-api/README.md) for full API documentation.

### Document Reader (✅ Implemented)

A Python/FastAPI service responsible for accepting personal documents and using OCR (Google Cloud Vision API) to extract text from them. No extracted data or documents are persisted after text extraction, ensuring data privacy. Hosted on Cloud Run, minimum instance set to 0, activated through API calls from the Gateway API.

- Accepts one or more uploaded files (`multipart/form-data`) via `POST /api/v1/documents/ocr`
- Extracts and classifies Brazilian document types (RG, CTPS, PIS, Birth/Marriage Certificate, Residence Proof, Diploma)
- Returns structured data as a downloadable Excel workbook (`.xlsx`)
- Supports optional `documentTypes` field to bypass auto-classification
- **Port:** 8004

See [apps/document-reader/README.md](../apps/document-reader/README.md) for full API documentation.

### Ingestor API (✅ Implemented)

A Python/FastAPI service responsible for downloading resumes from Google Sheets and Google Drive, extracting text from them, persisting the raw text in Firestore, and publishing events to Pub/Sub for the AI Worker to process. Hosted on Cloud Run, minimum instance set to 0, activated through API calls from the Gateway API.

- Accepts ingest requests via `POST /api/v1/ingest` with a Google Sheets URL and Drive file links
- Downloads resume files (PDF, DOCX) from Google Drive using Bugle
- Extracts raw text using PyMuPDF (PDF) or python-docx (DOCX) with layout-aware column detection for PDFs
- Persists raw text to Firestore via Synapse with `status=INGESTED` and metadata
- Publishes ingest events to the `resume-ingested` Pub/Sub topic for AI Worker consumption
- Failed rows get a `FAILED` Firestore stub with stage, error type, and error message
- **Port:** 8001
- **Pub/Sub topics:** publishes to `resume-ingested`, `dead-letter-queue`

See [apps/ingestor-api/README.md](../apps/ingestor-api/README.md) for full API documentation.

### AI Worker (✅ Implemented)

A Python/FastAPI service responsible for processing ingested resume data. Consumes Pub/Sub push messages and orchestrates the full AI pipeline: extraction → embedding → persistence → indexing event. Hosted on Cloud Run, minimum instance set to 0, activated through Pub/Sub push subscriptions.

- Receives `POST /api/v1/pubsub/push` from Cloud Pub/Sub with `resumeId` payload
- Retrieves raw resume text from Firestore via Synapse
- Extracts structured fields (name, skills, experience, education, etc.) using Vertex AI Gemini 1.5 Flash
- Generates multilingual embedding vectors using `text-multilingual-embedding-002`
- Persists structured data and embeddings back to Firestore
- Publishes `resume-indexed` events for downstream Search Base consumption
- Status lifecycle: `INGESTED` → `PROCESSING` → `PROCESSED` / `FAILED`
- **Port:** 8006
- **Pub/Sub topics:** consumes `resume-ingested`, publishes to `resume-indexed`, `dead-letter-queue`

See [apps/ai-worker/README.md](../apps/ai-worker/README.md) for full API documentation.

### DLQ Notifier (✅ Implemented)

A Python/FastAPI service responsible for processing dead-letter-queue messages and notifying operators. Also provides a REST API for user-facing and system-level notification management. Hosted on Cloud Run, minimum instance set to 0, activated through Pub/Sub push subscriptions.

- Receives `POST /api/v1/pubsub/push` from the `dead-letter-queue` Pub/Sub topic
- Sends email alerts via SMTP (Hermes `SmtpMessagingService`) to configured recipients
- Stores structured notifications in Firestore (`notifications` collection, 30-day TTL)
- Exposes notification REST API (used by frontend bell icon / notification panel):
  - `GET /api/v1/notifications` — user's own notifications
  - `GET /api/v1/notifications/system` — system-level notifications (admin only)
  - `PATCH /api/v1/notifications/{id}/read` — mark as read
  - `DELETE /api/v1/notifications/{id}` — dismiss
- Uses `X-User-Id` and `X-User-Role` headers injected by the Gateway for authorization
- **Port:** 8007
- **Pub/Sub topics:** consumes `dead-letter-queue`

See [apps/dlq-notifier/README.md](../apps/dlq-notifier/README.md) for full API documentation.

---

## Planned Services

> The following services are part of the target architecture but have not yet been implemented.

### Search Base (🔄 Planned)

A Python service responsible for handling search queries from the frontend and managing the FAISS vector index. Retrieves relevant resume data based on embeddings, runs FAISS similarity search for the top-k nearest vectors, and returns ranked results. Hosted on Cloud Run, minimum instance set to 0, activated through API calls from the Gateway API (for search queries) and through Pub/Sub (when new embeddings are indexed).

### File Generator (🔄 Planned)

A Python service responsible for generating resume documents and handling translations. Downloads and processes data from Firestore to render the final resume documents. Handles translation via Google Cloud Translation API, caching results in Firestore to reduce API calls. Hosted on Cloud Run, minimum instance set to 0, activated through API calls from the Gateway API.

---

## Shared Libraries (Node.js)

The following internal packages live under `shared/` and are consumed by the Node.js microservices (Gateway API, Users API):

| Package | Import | Purpose |
|---------|--------|---------|
| **Toolbox** | `@shared/toolbox` (tsconfig path alias) | Cross-cutting utilities: structured logger factory (`createLogger`), config loader (`loadConfigYaml`), Fastify hooks (`correlationIdHook`, `createCorrelationIdHook(logger)`, `createRequestLoggerHook`). `createCorrelationIdHook(logger)` emits `WARN`-level entries when `x-correlation-id` or `x-cloud-trace-context` headers are absent. Plain TypeScript source — no build step required. |
| **Bowltie** | `@elastic-resume-base/bowltie` | Uniform JSON response formatting via `formatSuccess` / `formatError`. Produces the standard `{ success, data/error, meta }` envelope used by all API responses. |
| **Harbor** | `@elastic-resume-base/harbor` | Centralized HTTP client factory (`createHarborClient`, `isHarborError`). All outbound HTTP calls from the Gateway API go through Harbor clients which automatically inject tracing headers via an Axios request interceptor. |
| **Synapse** | `@elastic-resume-base/synapse` | Persistence abstraction layer for Firebase/Firestore. Owns the `firebase-admin` dependency and exposes `IUserDocumentStore` / `IPreApprovedStore` interfaces with Firestore implementations. Must be initialized via `initializePersistence()` at service startup. |
| **Bugle** | `@elastic-resume-base/bugle` | Google API integration: `getGoogleAuthClient` and `DrivePermissionsService` for reading Google Drive file permissions. |

Each package ships with a `README.md`, full JSDoc on all exports, and its own test suite. See [`documentation/coding-standards/shared-libraries-standards.md`](coding-standards/shared-libraries-standards.md) for usage patterns and conventions.

---

## Infrastructure Components

| Component | Technology | Notes |
|-----------|------------|-------|
| **NoSQL Database** | Firestore | User data, resume data, embeddings. Accessed via Synapse abstraction. PII encrypted with Cloud KMS before storage. |
| **Async Messaging** | Cloud Pub/Sub | Decouples ingestion, AI processing, and indexing pipelines. Only identifiers (e.g., `resumeId`) are passed in messages. |
| **Authentication** | Firebase Auth (Google SSO) | Token verification by Gateway. No custom auth service needed. |
| **Transport Security** | TLS 1.2+ | All client-to-service and inter-service communication. |
| **Observability** | Google Cloud Logging | Centralized structured logging from all services via Pino. |