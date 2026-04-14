# AI Worker

The **AI Worker** is a Python microservice that processes resume ingestion events from Google Cloud Pub/Sub, extracts structured fields and generates semantic embeddings using Vertex AI, and persists the results to Firestore.

## Overview

```
resume-ingested (Pub/Sub)
    │
    ▼
AI Worker (this service)
    ├── Reads raw text from Firestore (resumes collection)
    ├── Extracts structured fields via Vertex AI Gemini
    ├── Generates embedding vectors via Vertex AI text-multilingual-embedding-002
    ├── Saves structured data to Firestore (resumes collection)
    ├── Saves embeddings to Firestore (embeddings collection)
    └── Publishes { resumeId } to resume-indexed (Pub/Sub)
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/pubsub/push` | Pub/Sub push endpoint — receives `resume-ingested` messages |
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |

### `POST /api/v1/pubsub/push`

Receives a Google Cloud Pub/Sub push message for a newly ingested resume and runs the AI processing pipeline.

**Request body:**

```json
{
  "message": {
    "data": "<base64-encoded JSON>",
    "messageId": "string",
    "publishTime": "string"
  },
  "subscription": "string"
}
```

The `message.data` field is a base64-encoded JSON object:

```json
{
  "resumeId": "string"
}
```

**Response (200 OK — permanent failure, no retry):**

```json
{
  "success": true,
  "data": {
    "resumeId": "string",
    "status": "FAILED",
    "message": "string"
  },
  "meta": {
    "correlationId": "string",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**Response (202 Accepted — processing succeeded):**

```json
{
  "success": true,
  "data": {
    "resumeId": "string",
    "status": "PROCESSED"
  },
  "meta": {
    "correlationId": "string",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**Response (500 Internal Server Error — transient failure, triggers Pub/Sub retry):**

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "string"
  },
  "meta": {
    "correlationId": "string",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### `GET /health/live`

Liveness probe used by container orchestrators.

**Response (200 OK):**

```json
{ "status": "ok" }
```

### `GET /health/ready`

Readiness probe — confirms the service is ready to process messages.

**Response (200 OK):**

```json
{ "status": "ok" }
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `GCP_PROJECT_ID` | `""` | Google Cloud project ID |
| `PORT` | `8006` | TCP port |
| `LOG_LEVEL` | `INFO` | Logging verbosity |
| `GOOGLE_APPLICATION_CREDENTIALS` | `""` | Path to service-account JSON (local dev only) |
| `VERTEX_AI_LOCATION` | `us-central1` | Vertex AI region |
| `VERTEX_AI_EXTRACTION_MODEL` | `gemini-1.5-flash` | Gemini model for structured extraction |
| `VERTEX_AI_EMBEDDING_MODEL` | `text-multilingual-embedding-002` | Embedding model |
| `FIRESTORE_COLLECTION_RESUMES` | `resumes` | Firestore resumes collection |
| `FIRESTORE_COLLECTION_EMBEDDINGS` | `embeddings` | Firestore embeddings collection |
| `PUBSUB_TOPIC_RESUME_INGESTED` | `resume-ingested` | Input Pub/Sub topic |
| `PUBSUB_TOPIC_RESUME_INDEXED` | `resume-indexed` | Output Pub/Sub topic |
| `PUBSUB_TOPIC_DLQ` | `dead-letter-queue` | Dead-letter queue topic |
| `HTTP_REQUEST_TIMEOUT` | `300` | Max request duration in seconds |
| `ENCRYPT_KMS_KEY_NAME` | `""` | Cloud KMS key for encrypting PII fields before Firestore persistence (production) |
| `DECRYPT_RAW_TEXT_KMS_KEY_NAME` | `""` | Cloud KMS key for decrypting raw resume text written by the Ingestor (production) |
| `LOCAL_FERNET_KEY` | `""` | Fernet key for local development encryption/decryption — **never use in production** |

All variables can also be set via `config.yaml` under `systems.ai-worker`.

### Encryption and Decryption

The AI Worker both decrypts the incoming raw resume text (encrypted by the Ingestor) and encrypts extracted PII fields before storing them in Firestore.

| Operation | Production variable | Local development variable |
|---|---|---|
| Decrypt raw text | `DECRYPT_RAW_TEXT_KMS_KEY_NAME` | `LOCAL_FERNET_KEY` (shared) |
| Encrypt PII fields | `ENCRYPT_KMS_KEY_NAME` | `LOCAL_FERNET_KEY` (shared) |

> ⚠️ **`LOCAL_FERNET_KEY` is for local development and testing only.** It is shared across all PII-handling services (`systems.shared.LOCAL_FERNET_KEY` in `config.yaml`) so that data encrypted by one service can be decrypted by another.  Generate a key with:
> ```bash
> python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
> ```
> **Never set `LOCAL_FERNET_KEY` in production** — use `ENCRYPT_KMS_KEY_NAME` and `DECRYPT_RAW_TEXT_KMS_KEY_NAME` instead.

## Resume Processing Status

The `status` field on each `resumes/{resumeId}` Firestore document tracks the processing pipeline:

| Status | Set By | Meaning |
|---|---|---|
| `INGESTED` | Ingestor | Raw text stored, awaiting AI processing |
| `PROCESSING` | AI Worker | Extraction/embedding in progress |
| `PROCESSED` | AI Worker | Successfully processed; downstream can index |
| `FAILED` | AI Worker | Processing failed; see `metadata.processingInfo.errors` |

## Firestore Data Model

### `resumes/{resumeId}`

Updated by the AI Worker with:
- `status`: `PROCESSED` or `FAILED`
- `metadata.structuredData`: extracted resume fields (name, email, skills, …)
- `metadata.processingInfo.processedAt` / `metadata.processingInfo.errors`

### `embeddings/{resumeId}`

Created by the AI Worker:
```json
{
  "resumeId": "abc-123",
  "fullTextEmbedding": [0.1, 0.2, ...],
  "skillsEmbedding": [0.3, 0.4, ...],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

All pipeline failures result in:
1. Firestore `status` updated to `FAILED` with error details in `metadata.processingInfo.errors`.
2. A message published to the `dead-letter-queue` Pub/Sub topic.
3. An HTTP 500 response returned to Pub/Sub (to trigger retries for transient errors) — or HTTP 200 for permanent errors (e.g. document not found).

## Local Development

```bash
# Install dependencies
pip install -r requirements/requirements-dev.txt

# Run the service
uvicorn app.main:app --host 0.0.0.0 --port 8006 --reload

# Run tests
pytest
```

Set `GCP_PROJECT_ID`, `FIRESTORE_EMULATOR_HOST`, and `PUBSUB_EMULATOR_HOST` in `config.yaml` or your environment for full local emulation.

## Testing

```bash
# Unit tests only (no GCP connection required)
pytest tests/unit/

# All tests with coverage
pytest --cov=app --cov-report=term-missing
```
