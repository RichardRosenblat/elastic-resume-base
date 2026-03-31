# Changelog — elastic-resume-base-toolbox (Python)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-03-31

### Added

**Middleware**

- `CorrelationIdMiddleware` — Starlette/FastAPI `BaseHTTPMiddleware` that reads or
  generates the `x-correlation-id` request header, parses the `x-cloud-trace-context`
  header (`TRACE_ID/SPAN_ID;o=FLAG`), and stores all three values in context variables
  for the duration of the request.
- `get_correlation_id() -> str` — returns the correlation ID for the current request
  context; returns `""` when called outside a request.
- `get_trace_id() -> str` — returns the GCP Cloud Trace trace ID for the current request
  context; returns `""` when called outside a request.
- `get_span_id() -> str` — returns the GCP Cloud Trace span ID for the current request
  context; returns `""` when called outside a request.

### Changed

- `CorrelationIdMiddleware` now emits `WARNING`-level log entries (via the standard
  `logging` module) when the incoming request is missing the `x-correlation-id` or
  `x-cloud-trace-context` header, before generating fallback values. This makes it easy
  to identify services that are not forwarding tracing headers.

---

## [1.0.0] — 2024-01-01

### Added

**Logging**

- `setup_logging(level: str = "INFO")` — configures the root logger with a structured
  JSON formatter; must be called once at application startup.
- `get_logger(name: str) -> logging.Logger` — returns a named logger; mirrors
  `createLogger` from the TypeScript package.

**Error classes**

- `AppError` — base class for all domain errors; carries `status_code: int` and
  `code: str`.
- `NotFoundError` (404), `UnauthorizedError` (401), `ValidationError` (400),
  `ConflictError` (409), `ForbiddenError` (403), `DownstreamError` (502),
  `UnavailableError` (503), `RateLimitError` (429) — all extend `AppError`.
- `is_app_error(err: BaseException) -> bool` — type-safe predicate for `except` blocks;
  mirrors `isAppError` from the TypeScript package.

**API types** (shared contract between TypeScript and Python services)

- `UserRecord`, `PreApprovedUser`, `AuthorizeRequest`, `AuthorizeResponse`,
  `CreateUserRequest`, `UpdateUserRequest`, `AddPreApprovedRequest`,
  `UpdatePreApprovedRequest`, `ListUsersResponse` — Users API wire types.
- `IngestRequest`, `IngestResponse` — Downloader service wire types.
- `SearchRequest`, `SearchResult`, `SearchResponse` — Search service wire types.
- `ResumeFormat`, `GenerateRequest`, `GenerateResponse` — File Generator service wire
  types.
- `DocumentReadOptions`, `DocumentReadRequest`, `DocumentReadResponse` — Document Reader
  service wire types.
- `IUsersApiClient`, `ISearchClient`, `IDocumentReaderClient`, `IDownloaderClient`,
  `IFileGeneratorClient` — service-client Protocol interfaces.
- `SortDirection`, `UserSortField`, `PreApprovedSortField`, `UserFilters`,
  `PreApprovedFilters` — query / filter helpers.
