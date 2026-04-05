# ADR-014: Structured Logging Strategy

**Date:** 2024-02-01
**Status:** Accepted

---

## Context

The platform runs across multiple runtimes (Node.js and Python) on Cloud Run. Logs from all services are aggregated in **Google Cloud Logging**. To query, filter, and alert on logs effectively, they must be structured (JSON), consistent in field names, and carry correlation identifiers so requests can be traced across services.

Requirements:
- JSON-structured logs in production for GCP Cloud Logging ingestion
- Human-readable coloured logs in development
- Per-module logger instances so log entries carry the originating module name
- Consistent log-level vocabulary across Node.js and Python services
- Correlation IDs (from `X-Correlation-ID` and `X-Cloud-Trace-Context` headers) propagated through every log entry within a request

---

## Decision

### Node.js services (Gateway API, Users API)

Use **Pino** (`pino` v9+) as the logger, with:
- **`@google-cloud/pino-logging-gcp-config`** in production — emits Cloud Logging–compatible JSON with `severity`, `httpRequest`, `logging.googleapis.com/trace`, etc.
- **`pino-pretty`** in development/test — colourised, human-readable output.
- A shared `createLogger(options)` factory in **Toolbox** (`@elastic-resume-base/toolbox`) so all services get a consistently configured instance.

### Python services (Ingestor API, AI Worker, Document Reader, DLQ Notifier)

Use the **Python standard library `logging`** module, with:
- A shared `setup_logging(level, json_format)` function and `get_logger(name)` factory in **Toolbox** (`elastic-resume-base-toolbox`).
- `json_format=True` in production — emits structured JSON lines compatible with Cloud Logging.
- `json_format=False` in development — emits human-readable output.
- A `_ContextFilter` that injects the current request's correlation ID and trace context from `contextvars` into every log record.

### Log level guidelines (both runtimes)

| Level | When to use |
|-------|-------------|
| **trace** / **DEBUG** (verbose) | Highly detailed step-by-step execution — function entry/exit with parameter values, internal loop iterations |
| **debug** / **DEBUG** | Service logic details — what data is being processed, which branch was taken |
| **info** / **INFO** | Key lifecycle events — server start, route registration, successful resource creation/deletion |
| **warn** / **WARNING** | Unexpected but recoverable — missing optional config, deprecated usage, retried operation |
| **error** / **ERROR** | Failures requiring attention — unhandled exceptions, downstream errors, auth failures |
| **fatal** / **CRITICAL** | Unrecoverable failures — process will exit |

---

## Alternatives Considered

| Option | Reason Not Chosen |
|--------|------------------|
| **Winston (Node.js)** | More configuration required for GCP-compatible JSON; Pino is faster and has a first-party GCP transport |
| **Loguru (Python)** | Non-standard; adds a dependency; standard `logging` has better ecosystem integration (e.g., Uvicorn, FastAPI) |
| **structlog (Python)** | Powerful but adds complexity; standard `logging` with a JSON formatter achieves the same result with less overhead |
| **console.log / print** | Not structured; not queryable; no level filtering; discarded in favour of proper logging from day one |

---

## Consequences

- **Easier:** Unified log format across all services; GCP Cloud Logging can parse `severity` and `trace` fields automatically; per-module loggers make it easy to filter by `logger` field; correlation IDs enable end-to-end request tracing.
- **Harder:** Developers must use `get_logger(__name__)` (Python) or `createLogger(...)` (Node.js) instead of bare `print`/`console.log`; log verbosity must be chosen carefully to avoid noise.
- **Follow-on decisions required:** Correlation ID propagation standard (header `X-Correlation-ID` and `X-Cloud-Trace-Context` carried by Toolbox middleware and Harbor HTTP client interceptors).
