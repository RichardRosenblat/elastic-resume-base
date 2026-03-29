# Bowltie (Python)

Bowltie is the **standard API response formatting library** for Elastic Resume Base Python microservices. It wraps any payload — from persistence layers, downstream services, or business logic — into a uniform JSON envelope identical to the one produced by the TypeScript services.

> **TypeScript version:** The TypeScript README can be found at [shared/Bowltie/bowltie_ts/README.md](../bowltie_ts/README.md). Both versions share the same envelope shape and API principles, but the Python version is a separate implementation.

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Success response formatting | ✅ Bowltie (`format_success`) |
| Error response formatting | ✅ Bowltie (`format_error`) |
| HTTP framework integration | ❌ Consuming service |
| Business logic | ❌ Consuming service |

---

## Installation

Bowltie is an internal package — not published to PyPI. Install it via a local path reference.

From your service directory:

```bash
pip install -e ../shared/Bowltie/bowltie_py
```

Or add the local path to your `requirements-dev.txt`:

```
-e ../shared/Bowltie/bowltie_py
```

For production images use a non-editable install in `requirements-prod.txt`:

```
../shared/Bowltie/bowltie_py
```

---

## Quick Start

```python
from bowltie_py import format_success, format_error
from fastapi.responses import JSONResponse

# Success — wrap any JSON-serialisable payload
return JSONResponse(format_success({"uid": "abc-123", "email": "alice@example.com"}))
# → {"success": true, "data": {...}, "meta": {"timestamp": "..."}}

# Error — produce a machine-readable + human-readable error envelope
return JSONResponse(format_error("NOT_FOUND", "Resume not found"), status_code=404)
# → {"success": false, "error": {"code": "NOT_FOUND", "message": "Resume not found"}, "meta": {...}}
```

---

## API Reference

### `format_success(data, correlation_id=None)`

Wraps `data` in a standard success envelope.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `data` | `Any` | ✅ | The response payload. Must be JSON-serialisable. |
| `correlation_id` | `str \| None` | ❌ | Optional request/trace ID for distributed tracing. |

**Returns:** `dict` — `{"success": True, "data": data, "meta": {"timestamp": ..., "correlationId": ...}}`

---

### `format_error(code, message, correlation_id=None)`

Produces a standard error envelope.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `code` | `str` | ✅ | Machine-readable error code (e.g. `"NOT_FOUND"`). |
| `message` | `str` | ✅ | Human-readable description of the error. |
| `correlation_id` | `str \| None` | ❌ | Optional request/trace ID for distributed tracing. |

**Returns:** `dict` — `{"success": False, "error": {"code": ..., "message": ...}, "meta": {"timestamp": ..., "correlationId": ...}}`

---

## Envelope Shapes

**Success**

```json
{
    "success": true,
    "data": { "uid": "abc-123", "email": "alice@example.com" },
    "meta": {
        "correlationId": "req-abc123",
        "timestamp": "2025-01-01T00:00:00.000Z"
    }
}
```

**Error**

```json
{
    "success": false,
    "error": {
        "code": "NOT_FOUND",
        "message": "Resume not found"
    },
    "meta": {
        "correlationId": "req-abc123",
        "timestamp": "2025-01-01T00:00:00.000Z"
    }
}
```

The `correlationId` key is **omitted** when no `correlation_id` argument is provided.

---

## Typical FastAPI Usage

**`app/routers/items.py`**

```python
from bowltie_py import format_success, format_error
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

@router.get("/items/{item_id}")
async def get_item(item_id: str) -> JSONResponse:
    item = db.get(item_id)
    if item is None:
        return JSONResponse(format_error("NOT_FOUND", f"Item {item_id!r} not found"), status_code=404)
    return JSONResponse(format_success(item))
```

**`app/main.py`** — global exception handler

```python
from bowltie_py import format_error
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from toolbox_py import is_app_error

app = FastAPI()

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code_map = {400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN",
                404: "NOT_FOUND", 422: "VALIDATION_ERROR", 500: "INTERNAL_ERROR"}
    code = code_map.get(exc.status_code, "HTTP_ERROR")
    return JSONResponse(format_error(code, str(exc.detail)), status_code=exc.status_code)

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if is_app_error(exc):
        return JSONResponse(format_error(exc.code, exc.message), status_code=exc.status_code)
    return JSONResponse(format_error("INTERNAL_ERROR", "An unexpected error occurred"), status_code=500)
```

---

## Development

```bash
# Install in editable mode
pip install -e .

# Run tests
pytest

# Run tests with coverage
pytest --cov --cov-report=term-missing

# Lint and format
ruff check bowltie_py/
black bowltie_py/

# Type-check
mypy bowltie_py/
```

Tests live in `../bowltie_ts/tests/` (the shared test directory), configured via `pyproject.toml`.

---

## License

Internal — Elastic Resume Base project.
