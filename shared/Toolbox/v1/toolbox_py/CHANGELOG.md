# Changelog — elastic-resume-base-toolbox (Python)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
