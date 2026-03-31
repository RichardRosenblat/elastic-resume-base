# Toolbox (Python)

Toolbox is a shared collection of **cross-cutting utility functions** for Elastic Resume Base Python microservices. It consolidates infrastructure-level code that would otherwise be duplicated across every service — structured logging and a standard HTTP error vocabulary — into a single, well-tested package.

> **TypeScript version:** The TypeScript README can be found at [shared/Toolbox/v1/toolbox_ts/README.md](../toolbox_ts/README.md). Both versions share the same design principles, but the Python version is a separate implementation targeted at FastAPI services.

---

## Responsibilities

| Concern | Handled by |
|---|---|
| Structured JSON logging initialisation | ✅ Toolbox (`setup_logging`) |
| Per-module logger factory | ✅ Toolbox (`get_logger`) |
| Correlation ID & Cloud Trace middleware | ✅ Toolbox (`CorrelationIdMiddleware`) |
| Standard HTTP error classes | ✅ Toolbox (`AppError` and subclasses) |
| Response formatting | ❌ Use [Bowltie](../../../Bowltie/v1/bowltie_py/README.md) |
| Business logic | ❌ Consuming service |

---

## Installation

Toolbox is an internal package — not published to PyPI. Install it via a local path reference.

From your service directory:

```bash
pip install -e ../shared/Toolbox/v1/toolbox_py
```

Or add the local path to your `requirements-dev.txt`:

```
-e ../shared/Toolbox/v1/toolbox_py
```

For production images use a non-editable install in `requirements-prod.txt`:

```
../shared/Toolbox/v1/toolbox_py
```

---

## Quick Start

```python
from toolbox_py import setup_logging, get_logger

# 1. Call once at application startup (before creating the FastAPI app)
setup_logging(level="INFO")

# 2. Obtain a per-module logger anywhere in the codebase
logger = get_logger(__name__)
logger.info("Service started")
logger.warning("Rate limit approaching", extra={"requests_remaining": 5})
```

---

## Modules

### `setup_logging(level="INFO", json_format=True)`

Initialises the root logger with structured formatting. Call **once** at application startup.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `level` | `str` | `"INFO"` | Logging level (`"DEBUG"`, `"INFO"`, `"WARNING"`, `"ERROR"`, `"CRITICAL"`). Case-insensitive. |
| `json_format` | `bool` | `True` | When `True`, emits Pino-compatible JSON lines suitable for Google Cloud Logging. When `False`, emits human-readable output for local development. |

Subsequent calls are idempotent — the handler is added only once.

```python
from toolbox_py import setup_logging

# Production (Cloud Logging compatible JSON)
setup_logging(level="INFO")

# Local development (human-readable)
setup_logging(level="DEBUG", json_format=False)
```

---

### `get_logger(name)`

Returns a `logging.Logger` for the given module name. Equivalent to `logging.getLogger(name)` but keeps all logger creation consistent.

```python
from toolbox_py import get_logger

logger = get_logger(__name__)
logger.debug("Processing request", extra={"resume_id": "abc-123"})
logger.info("User authenticated", extra={"uid": "uid-xyz"})
logger.error("OCR failed", extra={"filename": "document.pdf"})
```

---

### `CorrelationIdMiddleware`

Starlette/FastAPI `BaseHTTPMiddleware` that handles correlation ID and GCP Cloud Trace context propagation.

**Attach to your application before any other middleware that needs access to the context variables:**

```python
from toolbox_py import CorrelationIdMiddleware

app.add_middleware(CorrelationIdMiddleware)
```

**What it does on every request:**

1. Reads the `x-correlation-id` request header, or generates a new UUID v4 when absent.
   Logs a `WARNING` when the header is absent.
2. Reads and parses the `x-cloud-trace-context` request header (`TRACE_ID/SPAN_ID;o=FLAG`).
   When absent or malformed, derives the trace ID from the correlation ID (UUID without hyphens → 32 hex chars)
   and sets span ID to `"0"`. Logs a `WARNING` in this case.
3. Stores all three values in `contextvars` so that loggers configured via `setup_logging` include them automatically.
4. Echoes `x-correlation-id` and `x-cloud-trace-context` headers back in the response.

---

### `get_correlation_id()` / `get_trace_id()` / `get_span_id()`

Accessor functions that return the current request's tracing context from `contextvars`. Return an empty string when called outside a request context.

```python
from toolbox_py import get_correlation_id, get_trace_id, get_span_id

# Inside a request handler or service function:
cid  = get_correlation_id()   # e.g. "550e8400-e29b-41d4-a716-446655440000"
tid  = get_trace_id()          # e.g. "550e8400e29b41d4a716446655440000"
sid  = get_span_id()           # e.g. "0"
```

These values are also injected automatically into every log entry when the root logger is
configured with `setup_logging`.

---

Canonical application-level error classes shared across all Python microservices. Each class maps a domain error to an HTTP status code and a machine-readable code string — mirroring the TypeScript error classes in `shared/Toolbox/toolbox_ts/src/errors.ts`.

```python
from toolbox_py import (
    AppError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
    ConflictError,
    ForbiddenError,
    DownstreamError,
    UnavailableError,
    RateLimitError,
    is_app_error,
)
```

| Class | HTTP | Code | When to use |
|---|---|---|---|
| `AppError` | *(base)* | `"INTERNAL_ERROR"` | Base class — extend for custom domain errors |
| `NotFoundError` | 404 | `"NOT_FOUND"` | Resource does not exist |
| `UnauthorizedError` | 401 | `"UNAUTHORIZED"` | Missing or invalid authentication |
| `ValidationError` | 400 | `"VALIDATION_ERROR"` | Request body / query param validation failure |
| `ConflictError` | 409 | `"CONFLICT"` | Resource already exists (e.g. duplicate email) |
| `ForbiddenError` | 403 | `"FORBIDDEN"` | Authenticated user lacks permission |
| `DownstreamError` | 502 | `"DOWNSTREAM_ERROR"` | Downstream returned a response in an invalid/unexpected format |
| `UnavailableError` | 503 | `"SERVICE_UNAVAILABLE"` | Downstream is unreachable, timed out, or returned a 5xx error |
| `RateLimitError` | 429 | `"RATE_LIMIT_EXCEEDED"` | Caller has exceeded the request rate limit |

Each error exposes `.message`, `.status_code`, and `.code` attributes.

**`is_app_error(exc)`** — type-guard that returns `True` when `exc` is an `AppError` instance.

> **Semantic guideline for downstream errors:**
> - Raise `DownstreamError` when a downstream service *did* respond but the response could not be parsed or did not match the expected schema.
> - Raise `UnavailableError` when the downstream is unreachable, the request timed out, or the service returned a 5xx status code.

---

## Typical Service Setup

**`app/main.py`**

```python
from toolbox_py import setup_logging, get_logger, CorrelationIdMiddleware

setup_logging(level=settings.log_level)  # call before creating FastAPI app
logger = get_logger(__name__)

app = FastAPI(...)

# Attach CorrelationIdMiddleware first so tracing context is available everywhere
app.add_middleware(CorrelationIdMiddleware)

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    from toolbox_py import is_app_error
    from bowltie_py import format_error
    if is_app_error(exc):
        return JSONResponse(format_error(exc.code, exc.message), status_code=exc.status_code)
    logger.exception("Unhandled exception", exc_info=exc)
    return JSONResponse(format_error("INTERNAL_ERROR", "An unexpected error occurred"), status_code=500)
```

**`app/services/resume_service.py`** (example)

```python
from toolbox_py import get_logger, NotFoundError, DownstreamError

logger = get_logger(__name__)

class ResumeService:
    def get(self, resume_id: str) -> dict:
        logger.debug("Fetching resume", extra={"resume_id": resume_id})
        result = self._store.get(resume_id)
        if result is None:
            raise NotFoundError(f"Resume {resume_id!r} not found")
        return result

    def index(self, resume_id: str) -> None:
        try:
            self._downstream.post(f"/index/{resume_id}")
        except Exception as exc:
            raise UnavailableError("Indexing service unavailable") from exc
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
ruff check toolbox_py/
black toolbox_py/

# Type-check
mypy toolbox_py/
```

Tests live in `../toolbox_ts/tests/` (the shared test directory), configured via `pyproject.toml`.

---

## License

Internal — Elastic Resume Base project.
