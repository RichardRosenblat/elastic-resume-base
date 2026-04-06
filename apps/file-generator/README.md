# File Generator Service

A Python microservice that generates resume documents on demand.

## Overview

The File Generator service retrieves structured resume JSON from Firestore, fetches a `.docx` Jinja2 template from Google Drive using the Bugle shared library, renders the template with the resume data, and returns the final document to the caller.

Optionally, if a translation is requested, the service calls the Google Cloud Translation API before rendering — with results cached in Firestore to avoid redundant API calls. PII fields are decrypted with Cloud KMS before rendering.

**No generated files are persisted to any storage (per ADR-007).** The document content is returned as a base64-encoded string in the JSON response.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/resumes/{resume_id}/generate` | Generate a resume document |
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |
| `GET` | `/api/v1/docs` | Swagger UI |

### `POST /resumes/{resume_id}/generate`

**Request body:**
```json
{
  "language": "en",
  "format": "docx"
}
```

**Response (`200 OK`):**
```json
{
  "data": {
    "jobId": "gen-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "status": "completed",
    "fileContent": "<base64-encoded .docx bytes>",
    "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "filename": "resume-<resume_id>.docx"
  }
}
```

## Configuration

All settings are read from environment variables (or a `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8003` | TCP port |
| `LOG_LEVEL` | `INFO` | Log level |
| `GCP_PROJECT_ID` | `` | Google Cloud project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | `` | Path to service-account key (local dev) |
| `FIRESTORE_COLLECTION_RESUMES` | `resumes` | Firestore resume collection |
| `FIRESTORE_COLLECTION_TRANSLATION_CACHE` | `translation-cache` | Translation cache collection |
| `DRIVE_TEMPLATE_FILE_ID` | `` | Google Drive file ID for the `.docx` template |
| `LOCAL_TEMPLATE_PATH` | `` | Local template path (dev fallback) |
| `KMS_KEY_NAME` | `` | Cloud KMS key for PII decryption |
| `TRANSLATION_API_LOCATION` | `global` | Cloud Translation API region |

## Local Development

```bash
# Install dependencies
pip install -r requirements/requirements-dev.txt

# Run locally (with a local template file)
LOCAL_TEMPLATE_PATH=./templates/resume.docx uvicorn app.main:app --reload --port 8003
```

## Running Tests

```bash
pytest tests/ --asyncio-mode=auto -v
```

## Docker

```bash
# Build from monorepo root
docker build -f apps/file-generator/Dockerfile -t file-generator .

# Run
docker run -p 8003:8003 \
  -e DRIVE_TEMPLATE_FILE_ID=<file-id> \
  -e GCP_PROJECT_ID=<project> \
  file-generator
```
