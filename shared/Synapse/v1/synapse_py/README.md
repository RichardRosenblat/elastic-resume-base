# Synapse (Python)

Synapse is the **sole persistence layer** for Elastic Resume Base Python microservices. It owns every aspect of the Firestore connection — from SDK initialisation through to data-access abstractions — so that consuming services remain completely free of any direct `firebase-admin` dependency.

> **TypeScript version:** The TypeScript README can be found at [shared/Synapse/v1/synapse_ts/README.md](../synapse_ts/README.md). Both versions share the same design principles but are separate implementations targeted at their respective runtimes.

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Firebase Admin SDK initialisation | ✅ Synapse (`initialize_persistence`) |
| Firestore resume document access | ✅ Synapse (`FirestoreResumeStore`) |
| Graceful SDK shutdown | ✅ Synapse (`terminate_persistence`) |
| Business logic / HTTP routing | ❌ Consuming service (e.g. `ingestor`) |
| Response formatting | ❌ [Bowltie](../../../Bowltie/v1/bowltie_py/README.md) |
| Google Sheets / Drive access | ❌ [Bugle](../../../Bugle/v1/bugle_py/README.md) |

---

## Installation

Synapse is an internal package — not published to PyPI. Install it via a local path reference.

From your service directory:

```bash
pip install -e "../shared/Synapse/v1/synapse_py[firestore]"
```

The `[firestore]` extra installs `firebase-admin`, which is required for the `FirestoreResumeStore` and the `initialize_persistence` / `terminate_persistence` functions.

Or add the local path to your `requirements-dev.txt`:

```
-e "../shared/Synapse/v1/synapse_py[firestore]"
```

For production images use a non-editable install in `requirements-prod.txt`:

```
"../shared/Synapse/v1/synapse_py[firestore]"
```

> **Note:** `firebase-admin` is an **optional** dependency installed via the `[firestore]` extra. If you only need the interfaces and data models without a real Firestore backend, you can install without the extra.

---

## Quick Start

```python
from synapse_py import initialize_persistence, FirestoreResumeStore, CreateResumeData

# 1. Call once at application startup, before using any store.
initialize_persistence(project_id="my-gcp-project")

# 2. Create a store instance — Firestore is already initialised above.
store = FirestoreResumeStore()

# 3. Use the store.
resume = store.create_resume(
    CreateResumeData(
        raw_text="John Doe — Software Engineer...",
        source={"sheetId": "abc123", "row": 2},
    )
)
print(resume.id)       # auto-generated Firestore document ID
print(resume.status)   # "INGESTED"
```

---

## Modules

### Persistence initialisation (`persistence.py`)

This is the **entry point** every consuming service must call before using any store.

#### `initialize_persistence(project_id, service_account_key=None) → None`

Initialises the Firebase Admin SDK. Idempotent — subsequent calls after the first successful initialisation are no-ops.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `project_id` | `str` | ✅ | The Google Cloud project ID that owns the Firestore database. |
| `service_account_key` | `str \| None` | ❌ | Service-account key as a raw or Base64-encoded JSON string. Omit to use Application Default Credentials (ADC) — the recommended approach for Cloud Run. |

```python
from synapse_py import initialize_persistence
import os

initialize_persistence(
    project_id=os.environ["GCP_PROJECT_ID"],
    service_account_key=os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY"),
)
```

#### `terminate_persistence() → None`

Terminates the Firebase Admin SDK and releases Firestore connections. Idempotent. Call during graceful shutdown.

```python
from synapse_py import terminate_persistence

terminate_persistence()
```

---

### Resume store interface (`interfaces/resume_store.py`)

Services depend on the `IResumeStore` protocol — not on any concrete implementation — so the underlying database can be swapped without touching business logic.

```python
class IResumeStore(Protocol):
    def create_resume(self, data: CreateResumeData) -> ResumeDocument: ...
    def get_resume(self, resume_id: str) -> ResumeDocument: ...
    def update_resume(self, resume_id: str, data: UpdateResumeData) -> ResumeDocument: ...
```

#### `ResumeDocument`

| Field | Type | Description |
|---|---|---|
| `id` | `str` | Auto-generated Firestore document ID. |
| `raw_text` | `str` | Extracted plain text from the resume file. |
| `status` | `str` | Processing status (e.g. `"INGESTED"`, `"PROCESSED"`). |
| `source` | `dict` | Origin metadata (e.g. sheet ID, row number). |
| `metadata` | `dict` | Additional caller-supplied metadata. |
| `created_at` | `str` | ISO-8601 UTC timestamp of document creation. |
| `updated_at` | `str` | ISO-8601 UTC timestamp of last update. |

`ResumeDocument.to_dict()` returns a plain dictionary representation with camelCase keys (`rawText`, `createdAt`, `updatedAt`) compatible with the TypeScript Synapse library.

#### `CreateResumeData`

| Field | Type | Required | Description |
|---|---|---|---|
| `raw_text` | `str` | ✅ | The extracted plain text from the resume file. |
| `source` | `dict` | ✅ | Metadata about the origin of the resume. |
| `metadata` | `dict \| None` | ❌ | Additional metadata (defaults to `{}`). |

#### `UpdateResumeData`

All fields are optional. Only non-`None` fields are written to Firestore.

| Field | Type | Description |
|---|---|---|
| `raw_text` | `str \| None` | Updated plain text. |
| `status` | `str \| None` | Updated processing status. |
| `metadata` | `dict \| None` | Updated metadata. |

---

### Firestore implementation (`repositories/firestore_resume_store.py`)

`FirestoreResumeStore` is the default `IResumeStore` implementation backed by the `resumes` Firestore collection.

```python
from synapse_py import initialize_persistence, FirestoreResumeStore, CreateResumeData, UpdateResumeData

initialize_persistence(project_id="my-project")
store = FirestoreResumeStore()  # uses "resumes" collection by default

# Create
resume = store.create_resume(
    CreateResumeData(raw_text="...", source={"sheetId": "abc"})
)

# Read
fetched = store.get_resume(resume.id)

# Update
updated = store.update_resume(
    resume.id,
    UpdateResumeData(status="PROCESSED"),
)
```

A custom collection name can be passed to the constructor:

```python
store = FirestoreResumeStore(collection_name="dev_resumes")
```

---

### Error classes (`errors.py`)

All Synapse errors extend `SynapseError`.

| Class | Raised when |
|---|---|
| `SynapseError` | Base class — any Firestore operation fails. |
| `SynapseNotFoundError` | The requested document does not exist. |
| `SynapseConflictError` | A document already exists and creation would conflict. |

```python
from synapse_py import SynapseNotFoundError, SynapseError

try:
    resume = store.get_resume("nonexistent-id")
except SynapseNotFoundError as exc:
    print(f"Not found: {exc}")
except SynapseError as exc:
    print(f"Persistence error: {exc}")
```

---

## Implementing a New Database Backend

1. Create a class that implements `IResumeStore`.
2. Map provider-specific errors to the Synapse error classes.
3. Register your implementation in the consuming service.

```python
from synapse_py.interfaces.resume_store import IResumeStore, ResumeDocument, CreateResumeData, UpdateResumeData
from synapse_py.errors import SynapseNotFoundError, SynapseError

class PostgresResumeStore(IResumeStore):
    def get_resume(self, resume_id: str) -> ResumeDocument:
        row = db.execute("SELECT * FROM resumes WHERE id = %s", (resume_id,)).fetchone()
        if not row:
            raise SynapseNotFoundError(f"Resume '{resume_id}' not found.")
        return _map_row(row)

    # ... implement create_resume and update_resume
```

---

## Development

```bash
pip install -e ".[firestore]"   # Install in editable mode with Firestore extras
pytest                           # Run unit tests
pytest --cov                     # Run tests with coverage report
black .                          # Format code
ruff check .                     # Lint code
mypy synapse_py/                 # Type-check
```

---

## License

Internal — Elastic Resume Base project.
