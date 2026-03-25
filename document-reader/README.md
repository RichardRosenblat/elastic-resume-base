# Document Reader

A FastAPI microservice that accepts uploaded documents, extracts text via **Google Cloud Vision OCR**, identifies Brazilian document types, and returns the extracted structured data as an Excel file.

---

## Responsibilities

| Concern | Handled by |
|---|---|
| File upload validation | ✅ Document Reader (type, size) |
| ZIP archive expansion | ✅ Document Reader (`ZipService`) |
| OCR text extraction | ✅ Document Reader (`OcrService` → Cloud Vision API) |
| Brazilian document type detection | ✅ Document Reader (`ExtractorService`) |
| Regex field extraction | ✅ Document Reader (`ExtractorService`) |
| Excel report generation | ✅ Document Reader (`ExcelService`) |
| Authentication / authorisation | ❌ Not performed by this service |
| Persistence | ❌ Not performed by this service |

---

## Supported Document Types

| Key | Brazilian document |
|---|---|
| `RG` | Registro Geral (identity card) |
| `BIRTH_CERTIFICATE` | Certidão de Nascimento |
| `MARRIAGE_CERTIFICATE` | Certidão de Casamento |
| `WORK_CARD` | Carteira de Trabalho e Previdência Social (CTPS) |
| `PIS` | PIS / PASEP / NIS |
| `PROOF_OF_ADDRESS` | Comprovante de Residência / Endereço |
| `PROOF_OF_EDUCATION` | Diploma / Histórico Escolar |

If a document does not match any of the above it is recorded as `UNKNOWN`.

---

## Accepted File Formats

Direct upload: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.tiff`, `.tif`, `.bmp`, `.webp`, `.docx`

In addition, **`.zip`** archives may contain any mix of the above formats. Each archive entry is extracted and processed individually.

---

## API

### `POST /api/v1/documents/ocr`

Upload one or more documents (or ZIP archives) and receive an Excel file with extracted data.

**Request**

`Content-Type: multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `files` | `UploadFile[]` | One or more files to process |

**Response — 200 OK**

`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

Binary `.xlsx` file containing one row per processed document with columns derived from the document schema (filename, document type, extracted fields, raw OCR text).

**Error responses**

| Status | Code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Unsupported file type, or invalid / empty ZIP archive |
| 422 | `VALIDATION_ERROR` | File size exceeds limit (`MAX_FILE_SIZE_MB`, default 10 MB) |
| 502 | `DOWNSTREAM_ERROR` | Cloud Vision API call failed |

All error responses use the standard [Bowltie](../shared/Bowltie/bowltie_py/README.md) envelope:

```json
{
  "success": false,
  "error": { "code": "BAD_REQUEST", "message": "Unsupported file type '.xyz'. Allowed: ..." },
  "meta": { "timestamp": "2025-01-01T00:00:00.000Z" }
}
```

### `GET /health`

Liveness probe.

**Response — 200 OK**

```json
{ "success": true, "data": { "status": "ok" }, "meta": { "timestamp": "..." } }
```

---

## Configuration

Configuration is read from environment variables (or a `.env` file in the service root).

| Variable | Default | Description |
|---|---|---|
| `GCP_PROJECT_ID` | `""` | Google Cloud project ID used for Cloud Vision API calls |
| `PORT` | `8004` | Port the service listens on |
| `LOG_LEVEL` | `"INFO"` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `MAX_FILE_SIZE_MB` | `10` | Maximum accepted file size in megabytes |

---

## Architecture

```
POST /api/v1/documents/ocr
        │
        ▼
  documents router
        │  validate uploads (type, size)
        │  expand .zip archives (ZipService)
        │
        ▼
  OcrService
        │  .docx → python-docx (text extraction)
        │  .pdf  → PyMuPDF (render pages as images) → Cloud Vision
        │  image → Cloud Vision document_text_detection
        │
        ▼
  ExtractorService
        │  keyword matching → DocumentType
        │  regex field extraction (DOCUMENT_SCHEMA)
        │
        ▼
  ExcelService
        │  openpyxl workbook generation
        │  columns derived from DOCUMENT_SCHEMA
        │
        ▼
  StreamingResponse (.xlsx)
```

---

## Development

### Prerequisites

- Python 3.11+
- A Google Cloud project with the Cloud Vision API enabled
- Application Default Credentials configured (e.g. `gcloud auth application-default login`)

### Install dependencies

```bash
pip install -r requirements/requirements-dev.txt
```

This installs all runtime dependencies plus the shared Python libraries ([Toolbox](../shared/Toolbox/toolbox_py/README.md), [Bowltie](../shared/Bowltie/bowltie_py/README.md), [Hermes](../shared/Hermes/hermes_py/README.md)) in editable mode.

### Run locally

```bash
uvicorn app.main:app --reload --port 8004
```

### Run tests

```bash
pytest
```

Tests require no real GCP credentials — all Cloud Vision API calls are mocked.

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
docker build -f document-reader/Dockerfile -t document-reader .
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
| `google-cloud-vision` | OCR via Cloud Vision API |
| `pymupdf` | Render PDF pages as images |
| `python-docx` | Extract text from DOCX files |
| `openpyxl` | Generate Excel workbooks |
| `python-multipart` | Multipart form upload parsing |
| `elastic-resume-base-toolbox` | Structured logging and error classes |
| `elastic-resume-base-bowltie` | Standard JSON response envelopes |

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
