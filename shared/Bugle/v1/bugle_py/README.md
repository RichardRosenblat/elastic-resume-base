# Bugle (Python)

Bugle is a shared **Google API client** library for Elastic Resume Base Python microservices. It provides authenticated clients for **Google Sheets** and **Google Drive**, consolidating all Google API interaction patterns into a single, well-tested package.

> **TypeScript version:** The TypeScript README can be found at [shared/Bugle/v1/bugle_ts/README.md](../bugle_ts/README.md). Both versions share the same design principles but are separate implementations.

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Service-account authentication with Google APIs | ✅ Bugle (`get_google_auth_client`) |
| Reading rows and column values from Google Sheets | ✅ Bugle (`SheetsService`) |
| Downloading files from Google Drive | ✅ Bugle (`DriveService`) |
| Extracting Drive file IDs from URLs | ✅ Bugle (`extract_drive_id`) |
| Business logic / HTTP routing | ❌ Consuming service |
| Firestore persistence | ❌ [Synapse](../../../Synapse/v1/synapse_py/README.md) |

---

## Installation

Bugle is an internal package — not published to PyPI. Install it via a local path reference.

From your service directory:

```bash
pip install -e ../shared/Bugle/v1/bugle_py
```

Or add the local path to your `requirements-dev.txt`:

```
-e ../shared/Bugle/v1/bugle_py
```

For production images use a non-editable install in `requirements-prod.txt`:

```
../shared/Bugle/v1/bugle_py
```

---

## Configuration

Bugle authenticates with Google APIs via a **Service Account** key loaded entirely from an environment variable — no credential files are read from disk.

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | ✅ Yes | Raw JSON **or** Base64-encoded JSON of the Google Service Account key file. |

### Obtaining a Service Account Key

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **IAM & Admin → Service Accounts**.
3. Create or select a service account and generate a JSON key.
4. Grant the service account at least:
   - **Sheets API read** access to the spreadsheets you need to read.
   - **Drive File Viewer** (`roles/drive.viewer`) on the files you need to download.
5. Set the key as an environment variable:

```bash
# Option A: raw JSON
export GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'

# Option B: Base64-encoded (recommended for containers)
export GOOGLE_SERVICE_ACCOUNT_KEY=$(base64 -w0 path/to/key.json)
```

---

## Quick Start

```python
from bugle_py import SheetsService, DriveService

# Read resume links from a Google Sheet
sheets = SheetsService()
links = sheets.get_column_values(
    spreadsheet_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
    column_header="resume_link",
)
# → [(2, "https://drive.google.com/file/d/..."), (3, "https://drive.google.com/file/d/...")]

# Download a resume file from Google Drive
drive = DriveService()
content, mime_type = drive.download_file(file_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms")
```

---

## Modules

### Auth (`auth.py`)

Provides `get_google_auth_client`, a factory that reads `GOOGLE_SERVICE_ACCOUNT_KEY` from the environment and returns a configured `google.oauth2.service_account.Credentials` instance.

```python
from bugle_py import get_google_auth_client, DRIVE_READONLY_SCOPES, SHEETS_READONLY_SCOPES

# Use default Drive read-only scopes
credentials = get_google_auth_client()

# Or request Sheets scopes
sheets_credentials = get_google_auth_client(SHEETS_READONLY_SCOPES)

# Or request custom scopes
custom_credentials = get_google_auth_client(["https://www.googleapis.com/auth/drive"])
```

#### Scope constants

| Constant | Value |
|---|---|
| `DRIVE_READONLY_SCOPES` | `drive.readonly`, `drive.metadata.readonly` |
| `SHEETS_READONLY_SCOPES` | `spreadsheets.readonly` |

---

### SheetsService (`services/sheets_service.py`)

Uses the **Google Sheets API v4** to read spreadsheet data.

#### `get_all_rows(spreadsheet_id, sheet_name=None) → list[list[str]]`

Retrieves all rows from a Google Sheet. The first row (header) is included at index 0.

```python
from bugle_py import SheetsService

service = SheetsService()
rows = service.get_all_rows(spreadsheet_id="1BxiMVs0XRA5...")
# rows[0] → ['name', 'email', 'resume_link']
# rows[1] → ['Alice', 'alice@example.com', 'https://drive.google.com/...']
```

| Parameter | Type | Description |
|---|---|---|
| `spreadsheet_id` | `str` | The Google Sheets file ID. |
| `sheet_name` | `str \| None` | Optional sheet (tab) name. Defaults to the first sheet. |

#### `get_column_values(spreadsheet_id, column_header, sheet_name=None) → list[tuple[int, str]]`

Returns all non-empty values from the column identified by `column_header` (case-insensitive), together with their 1-based row numbers.

```python
links = service.get_column_values(
    spreadsheet_id="1BxiMVs0XRA5...",
    column_header="resume_link",
)
# → [(2, "https://drive.google.com/file/d/abc"), (4, "https://drive.google.com/file/d/xyz")]
```

| Parameter | Type | Description |
|---|---|---|
| `spreadsheet_id` | `str` | The Google Sheets file ID. |
| `column_header` | `str` | The header label of the column to read (case-insensitive). |
| `sheet_name` | `str \| None` | Optional sheet (tab) name. |

Raises `ValueError` if the sheet is empty or the column header is not found.

#### `extract_drive_id(value) → str | None`

A module-level utility function that extracts a Google Drive file ID from a URL or returns `None` if the value cannot be parsed.

```python
from bugle_py.services.sheets_service import extract_drive_id

extract_drive_id("https://drive.google.com/file/d/1BxiMVs0XRA5nFMd.../view")
# → "1BxiMVs0XRA5nFMd..."

extract_drive_id("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms")
# → "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"  (bare ID returned as-is)

extract_drive_id("not-a-drive-url")
# → None
```

---

### DriveService (`services/drive_service.py`)

Uses the **Google Drive API v3** to retrieve file metadata and download file content.

#### `get_file_metadata(file_id) → dict`

Retrieves metadata for a Google Drive file.

```python
from bugle_py import DriveService

service = DriveService()
metadata = service.get_file_metadata(file_id="1BxiMVs0XRA5...")
# → {"id": "...", "name": "resume.pdf", "mimeType": "application/pdf", "size": "123456"}
```

#### `download_file(file_id) → tuple[bytes, str]`

Downloads the binary content of a Google Drive file. Returns a tuple of `(content_bytes, mime_type)`.

For Google native formats, the file is automatically exported:

| Source MIME type | Exported as |
|---|---|
| `application/vnd.google-apps.document` | DOCX |
| `application/vnd.google-apps.spreadsheet` | XLSX |
| `application/vnd.google-apps.presentation` | PPTX |

```python
content, mime_type = service.download_file(file_id="1BxiMVs0XRA5...")
# → (b'...binary content...', 'application/pdf')
```

#### Custom credentials

You can pass pre-configured credentials if you need fine-grained control:

```python
from bugle_py import get_google_auth_client, DRIVE_READONLY_SCOPES, DriveService, SheetsService

credentials = get_google_auth_client(DRIVE_READONLY_SCOPES)
drive = DriveService(credentials=credentials)
sheets = SheetsService(credentials=credentials)
```

---

## Development

```bash
pip install -e ".[dev]"   # Install in editable mode with dev extras
pytest                     # Run unit tests
pytest --cov               # Run tests with coverage report
black .                    # Format code
ruff check .               # Lint code
mypy bugle_py/             # Type-check
```

---

## License

Internal — Elastic Resume Base project.
