# Bugle (Python) — v2

Bugle is a shared **Google API client** library for Elastic Resume Base Python microservices. It provides authenticated clients for **Google Sheets** and **Google Drive**, consolidating all Google API interaction patterns into a single, well-tested package.

> **TypeScript version:** The TypeScript README can be found at [shared/Bugle/v2/bugle_ts/README.md](../bugle_ts/README.md). Both versions share the same design principles but are separate implementations.

> **v1 (legacy):** The previous version using `GOOGLE_SERVICE_ACCOUNT_KEY` is still available at [shared/Bugle/v1/bugle_py](../../v1/bugle_py/README.md).

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Google Sheets data reading | ✅ Bugle (`SheetsService`) |
| Google Drive file download | ✅ Bugle (`DriveService`) |
| Authentication | ✅ ADC via `google-auth` |

---

## Installation

```bash
pip install -e ../../shared/Bugle/v2/bugle_py
```

Or add to `requirements-dev.txt`:

```
-e ../../shared/Bugle/v2/bugle_py
```

---

## Configuration

Bugle v2 authenticates with Google APIs via **Application Default Credentials (ADC)** — no `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable is required.

ADC resolves credentials automatically:

| Environment | How ADC resolves credentials |
|---|---|
| Local development | `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS` path |
| CI | `GOOGLE_APPLICATION_CREDENTIALS` pointing to a JSON key file |
| Production (Cloud Run) | Attached service account identity (no env vars needed) |

### Local development setup

```bash
# Option A: Use gcloud CLI
gcloud auth application-default login

# Option B: Point to a JSON key file
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

---

## Quick Start

```python
from bugle_py import SheetsService, DriveService

# Read Drive links from a Google Sheet
sheets = SheetsService()
links = sheets.get_column_values(spreadsheet_id="<SHEET_ID>", column_header="resume_link")

# Download a file from Google Drive
drive = DriveService()
content, mime_type = drive.download_file(file_id="<FILE_ID>")
```

---

## Modules

### Auth (`auth.py`)

| Export | Description |
|---|---|
| `get_google_auth_client(scopes?, credentials?)` | Returns ADC credentials (or explicit credentials if provided). |
| `DRIVE_READONLY_SCOPES` | Drive read-only OAuth 2.0 scopes. |
| `SHEETS_READONLY_SCOPES` | Sheets read-only OAuth 2.0 scopes. |

### SheetsService

| Method | Description |
|---|---|
| `get_all_rows(spreadsheet_id, sheet_name?)` | Returns all rows from a Google Sheet. |
| `get_column_values(spreadsheet_id, column_header?, ...)` | Returns `(row_number, value)` tuples from a specified column. |

### DriveService

| Method | Description |
|---|---|
| `get_file_metadata(file_id)` | Returns metadata dict for a Drive file. |
| `download_file(file_id)` | Returns `(content_bytes, mime_type)` for a Drive file. |

---

## Development

```bash
pip install -e ".[dev]"   # Install with dev dependencies
pytest                     # Run unit tests
pytest --cov=bugle_py      # Run with coverage
black bugle_py/ tests/     # Format code
ruff check bugle_py/ tests/ # Lint
mypy bugle_py/             # Type-check
```

---

## License

Internal — Elastic Resume Base project.
