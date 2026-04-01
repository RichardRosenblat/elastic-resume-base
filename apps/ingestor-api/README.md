# Ingestor

A FastAPI microservice that reads resume file links from a **Google Sheet**, downloads each file from **Google Drive**, extracts plain text with layout-aware column detection, stores the raw text in **Firestore**, and publishes an ingestion event to **Cloud Pub/Sub** to trigger the downstream AI processing pipeline.

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Google Sheets link discovery | ✅ Ingestor (`SheetsService` via Bugle) |
| Google Drive file download | ✅ Ingestor (`DriveService` via Bugle) |
| PDF text extraction (multi-column) | ✅ Ingestor (`text_extractor` — pdfplumber) |
| DOCX text extraction | ✅ Ingestor (`text_extractor` — python-docx) |
| Resume persistence | ✅ Ingestor (`FirestoreResumeStore` via Synapse) |
| Pub/Sub event publishing | ✅ Ingestor (`IPublisher` via Hermes) |
| Dead-letter queue (row errors) | ✅ Ingestor (DLQ Pub/Sub topic) |
| Authentication / authorisation | ❌ Not performed by this service |
| AI resume processing | ❌ Triggered downstream via Pub/Sub |

---

## Accepted File Formats

| Extension | Extraction method |
|---|---|
| `.pdf` | `pdfplumber` — multi-column layout detection |
| `.docx` | `python-docx` — paragraphs and table cells |

Google Docs files are exported to DOCX automatically before download.

---

## API

### `POST /api/v1/ingest`

Trigger a resume ingestion job from a Google Sheet.

**Request**

`Content-Type: application/json`

| Field | Type | Required | Description |
|---|---|:---:|---|
| `sheet_id` | `string` | ✴ | Google Sheets file ID. One of `sheet_id` or `sheet_url` is required. |
| `sheet_url` | `string` | ✴ | Full Google Sheets URL. The service extracts the ID automatically. |
| `link_column` | `string` | No | Column header containing Drive links. Defaults to `resume_link`. |
| `metadata` | `object` | No | Extra metadata attached to every ingested resume document in Firestore. |

✴ At least one of `sheet_id` or `sheet_url` must be provided.

**Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "ingested": 5,
    "errors": [
      { "row": 3, "error": "Failed to download Drive file '...': 404" }
    ]
  },
  "meta": {
    "correlationId": "00000000-0000-0000-0000-000000000000",
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

Row-level failures are non-fatal — the endpoint returns `200` with a partial result and the per-row error descriptions.

**Error responses**

| Status | Code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Neither `sheet_id` nor `sheet_url` provided, or the sheet ID cannot be resolved |
| 422 | `VALIDATION_ERROR` | Malformed request body |
| 502 | `DOWNSTREAM_ERROR` | Could not read the Google Sheet |

All error responses use the standard [Bowltie](../../shared/Bowltie/v1/bowltie_py/README.md) envelope:

```json
{
  "success": false,
  "error": { "code": "BAD_REQUEST", "message": "Either 'sheet_id' or 'sheet_url' must be provided." },
  "meta": { "correlationId": "...", "timestamp": "..." }
}
```

### `GET /health/live`

Liveness probe — confirms the service process is running.

**Response — 200 OK**

```json
{ "success": true, "data": { "status": "ok" }, "meta": { "timestamp": "..." } }
```

### `GET /health/ready`

Readiness probe — confirms the service is ready to accept traffic.

**Response — 200 OK**

```json
{ "success": true, "data": { "status": "ok" }, "meta": { "timestamp": "..." } }
```

---

## API Documentation (Swagger UI)

| URL | Description |
|---|---|
| `GET /api/v1/docs` | Swagger UI — browse and try all endpoints interactively |
| `GET /api/v1/redoc` | ReDoc — alternative documentation UI |
| `GET /api/v1/docs/json` | Raw OpenAPI JSON schema |

---

## Configuration

Configuration is read from environment variables (or a `.env` file in the service root). A `config.yaml` / `configs.yaml` at the monorepo root is also loaded via `toolbox_py.load_config_yaml` — values from `systems.shared` and `systems.ingestor` are merged, and only variables **not** already present in the environment are set.

| Variable | Default | Description |
|---|---|---|
| `GCP_PROJECT_ID` | `""` | Google Cloud project ID for Firestore and Pub/Sub |
| `PORT` | `8001` | Port the service listens on |
| `LOG_LEVEL` | `"INFO"` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | `""` | Path to a GCP service-account JSON key (local dev only; leave empty in production to use ADC) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | `""` | Raw or Base64-encoded service-account JSON used by Bugle to authenticate with Sheets and Drive APIs |
| `FIRESTORE_COLLECTION_RESUMES` | `"resumes"` | Firestore collection name for resume documents |
| `PUBSUB_TOPIC_RESUME_INGESTED` | `"resume-ingested"` | Pub/Sub topic published to after each successful ingestion |
| `PUBSUB_TOPIC_DLQ` | `"dead-letter-queue"` | Dead-letter Pub/Sub topic for row-level errors |
| `SHEETS_LINK_COLUMN` | `"resume_link"` | Default column header in the spreadsheet that contains Drive links |
| `HTTP_REQUEST_TIMEOUT` | `120` | Maximum seconds per request before a 504 response is returned. Health endpoints are excluded. |
| `RATE_LIMIT_PER_MINUTE` | `60` | Maximum requests per client IP per minute before an HTTP 429 is returned |

---

## Architecture

```
POST /api/v1/ingest
        │
        ▼
  ingest router
        │  resolve sheet_id from sheet_id / sheet_url
        │
        ▼
  IngestService
        │
        ├─── SheetsService (Bugle)
        │       read column → list of (row_number, drive_link)
        │
        ├─── DriveService (Bugle)
        │       download_file(file_id) → (bytes, mime_type)
        │
        ├─── text_extractor
        │       PDF  → pdfplumber (column detection → line grouping → LLM cleanup)
        │       DOCX → python-docx (paragraphs + table cells)
        │
        ├─── FirestoreResumeStore (Synapse)
        │       create_resume(raw_text, source, metadata) → resumeId
        │
        └─── IPublisher (Hermes)
                publish("resume-ingested", { resumeId })
                publish("dead-letter-queue", { row, error })  ← row errors only
```

**PDF column detection** (pdfplumber):

1. Project all word bounding boxes onto the X-axis and merge overlapping intervals.
2. Identify gutters (gaps ≥ 20 pt) between merged blocks — each gutter marks a column boundary.
3. For each column, group words by vertical proximity, sort horizontally, and reconstruct lines.
4. Join columns with `------` dividers; join pages with `====================` dividers.
5. Clean formatting artefacts (hyphenated line breaks, arrow characters, excess whitespace).

---

## Development

### Prerequisites

- Python 3.11 | 3.12
- A Google Cloud project with Firestore and Cloud Pub/Sub enabled, **or** the Firebase emulators running locally
- A Google Cloud service account with read access to the target Sheets and Drive files (set `GOOGLE_SERVICE_ACCOUNT_KEY`)

### Install dependencies

```bash
pip install -r requirements/requirements-dev.txt
```

This installs all runtime dependencies plus the shared Python libraries ([Toolbox](../../shared/Toolbox/v1/toolbox_py/README.md), [Bowltie](../../shared/Bowltie/v1/bowltie_py/README.md), [Hermes](../../shared/Hermes/v1/hermes_py/README.md), [Bugle](../../shared/Bugle/v1/bugle_py/README.md), [Synapse](../../shared/Synapse/v1/synapse_py/README.md)) in editable mode.

### Run locally

```bash
uvicorn app.main:app --reload --port 8001
```

### Run tests

```bash
pytest
```

Tests require no real GCP credentials — all Google API calls and Pub/Sub interactions are mocked.

### Lint and format

```bash
ruff check app/ tests/
black app/ tests/
mypy app/
```

---

## Docker

Build from the **monorepo root** so that the shared Python libraries are available:

```bash
docker build -f apps/ingestor-api/Dockerfile -t ingestor-api .
```

The Dockerfile copies the shared libraries into `/app/shared/` and installs them from the production requirements file before copying the service source.

---

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `fastapi` | HTTP framework |
| `uvicorn[standard]` | ASGI server |
| `pydantic-settings` | Environment variable parsing |
| `pdfplumber` | Layout-aware PDF text extraction |
| `python-docx` | Extract text from DOCX files |
| `google-api-python-client` | Google Sheets and Drive API client |
| `google-auth` | Google Cloud authentication |
| `firebase-admin` | Firestore SDK (via Synapse) |
| `google-cloud-pubsub` | Cloud Pub/Sub client (via Hermes) |
| `elastic-resume-base-toolbox` | Structured logging, middleware, and error classes |
| `elastic-resume-base-bowltie` | Standard JSON response envelopes |
| `elastic-resume-base-hermes` | Pub/Sub publisher abstraction |
| `elastic-resume-base-bugle` | Google Sheets and Drive service wrappers |
| `elastic-resume-base-synapse` | Firestore resume store abstraction |

### Dev / test

| Package | Purpose |
|---|---|
| `pytest` / `pytest-asyncio` | Test runner |
| `pytest-cov` | Coverage reporting |
| `httpx` | ASGI test client |
| `black` / `ruff` / `mypy` | Linting and type checking |

---

## License

Internal — Elastic Resume Base project.
