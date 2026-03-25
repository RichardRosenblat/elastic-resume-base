# Services Overview

This document describes each service and component in the Elastic Resume Base platform. For the current implementation status of each service, see the [README](../README.md#implementation-status).

---

## Implemented Services

### Frontend SPA (✅ Implemented)

A React + TypeScript single-page application that serves as the user interface for the platform. Hosted on Firebase Hosting (or served via the Docker Compose stack during local development).

- Authenticates users with Firebase Auth (email/password and Google SSO)
- Calls the BFF Gateway for all API interactions; never communicates directly with microservices
- Enforces role-based access: admin-only pages (`/users`) are guarded at the routing level
- Feature flags driven by `VITE_FEATURE_*` environment variables allow progressive rollout of backend features
- Supports English, Portuguese (Brazil), and Spanish via i18next
- Responsive layout built with Material UI (MUI) v7

See [frontend/README.md](../frontend/README.md) for environment variables, setup instructions, and development guide.

### BFF Gateway (✅ Implemented)

Backend For Frontend service responsible for handling requests from the frontend and communicating with backend services. Hosted on Cloud Run (while at low usage, minimum instances can be set to 0; higher-performance options can be enabled as needed).

- Verifies Firebase ID tokens on every authenticated request
- Calls Users API to resolve the user's role and `enable` status
- Enforces role-based access control (RBAC) on protected routes
- Routes requests to downstream microservices

See [bff-gateway/README.md](../bff-gateway/README.md) for API documentation.

### Users API (✅ Implemented)

A Node.js/TypeScript microservice that manages user records and implements the BFF Authorization Logic for the platform. Hosted on Cloud Run, minimum instance set to 0, activated through API calls from the BFF.

- Stores user records (uid, email, role, enable) in Firestore via Synapse
- Exposes a `POST /api/v1/users/authorize` endpoint called by the BFF during every login
- Manages a `pre_approved_users` collection for admin-controlled user onboarding
- Supports auto-onboarding of users from configurable email domains

See [users-api/README.md](../users-api/README.md) for full API documentation.

---

## Planned Services

> The following services are part of the target architecture but have not yet been implemented.

### Frontend SPA (🔄 Planned — see above for current implementation)

> The base frontend is implemented. The following backend-dependent features are not yet available: resume ingest, AI worker, search, and file generation. These are controlled via feature flags in `VITE_FEATURE_*` environment variables.

### Ingestor Service (🔄 Planned)

A Python service responsible for downloading resumes from Google Sheets and Google Drive, extracting text from the resumes, and storing the extracted data in Firestore. Hosted on Cloud Run, minimum instance set to 0, activated through API calls from the BFF. Publishes to a Pub/Sub queue for the AI Worker to process.

### AI Worker (🔄 Planned)

A Python service responsible for processing resume data. Handles both the extraction of relevant information from raw resume text using Vertex AI (Gemini 1.5 Flash) and the creation of embeddings using `text-multilingual-embedding-002`. Hosted on Cloud Run, minimum instance set to 0, activated through Pub/Sub. After processing, stores the structured JSON and embeddings in Firestore and publishes to Pub/Sub for the Search Base to index.

### Search Base (🔄 Planned)

A Python service responsible for handling search queries from the frontend and managing the FAISS vector index. Retrieves relevant resume data based on embeddings, runs FAISS similarity search for the top-k nearest vectors, and returns ranked results. Hosted on Cloud Run, minimum instance set to 0, activated through API calls from the BFF (for search queries) and through Pub/Sub (when new embeddings are indexed).

### File Generator (🔄 Planned)

A Python service responsible for generating resume documents and handling translations. Downloads and processes data from Firestore to render the final resume documents. Handles translation via Google Cloud Translation API, caching results in Firestore to reduce API calls. Hosted on Cloud Run, minimum instance set to 0, activated through API calls from the BFF.

### Document Reader (🔄 Planned)

A Python service responsible for accepting personal documents and using OCR (Google Cloud Vision API) to extract text from them. No extracted data or documents are persisted after text extraction, ensuring data privacy. Hosted on Cloud Run, minimum instance set to 0, activated through API calls from the BFF.

### DLQ Notifier (🔄 Planned)

A Python service responsible for monitoring the Dead Letter Queue (DLQ) for failed messages and sending notifications (e.g., Slack) for further investigation. Hosted on Cloud Run, minimum instance set to 0, activated through Pub/Sub when messages are sent to the DLQ.

---

## Shared Libraries (Node.js)

The following internal packages live under `shared/` and are consumed by the Node.js microservices (BFF Gateway, Users API):

| Package | Import | Purpose |
|---------|--------|---------|
| **Toolbox** | `shared/Toolbox/src/` (relative path) | Cross-cutting utilities: structured logger factory (`createLogger`), config loader (`loadConfigYaml`), Fastify middleware hooks (`correlationIdHook`, `createRequestLoggerHook`). Plain TypeScript source — no build step required. |
| **Bowltie** | `@elastic-resume-base/bowltie` | Uniform JSON response formatting via `formatSuccess` / `formatError`. Produces the standard `{ success, data/error, meta }` envelope used by all API responses. |
| **Synapse** | `@elastic-resume-base/synapse` | Persistence abstraction layer for Firebase/Firestore. Owns the `firebase-admin` dependency and exposes `IUserDocumentStore` / `IPreApprovedStore` interfaces with Firestore implementations. Must be initialized via `initializePersistence()` at service startup. |
| **Bugle** | `@elastic-resume-base/bugle` | Google API integration: `getGoogleAuthClient` and `DrivePermissionsService` for reading Google Drive file permissions. |

Each package ships with a `README.md`, full JSDoc on all exports, and its own test suite. See [`documentation/coding-standards/shared-libraries-standards.md`](coding-standards/shared-libraries-standards.md) for usage patterns and conventions.

---

## Infrastructure Components

| Component | Technology | Notes |
|-----------|------------|-------|
| **NoSQL Database** | Firestore | User data, resume data, embeddings. Accessed via Synapse abstraction. PII encrypted with Cloud KMS before storage. |
| **Async Messaging** | Cloud Pub/Sub | Decouples ingestion, AI processing, and indexing pipelines. Only identifiers (e.g., `resumeId`) are passed in messages. |
| **Authentication** | Firebase Auth (Google SSO) | Token verification by BFF Gateway. No custom auth service needed. |
| **Transport Security** | TLS 1.2+ | All client-to-service and inter-service communication. |
| **Observability** | Google Cloud Logging | Centralized structured logging from all services via Pino. |