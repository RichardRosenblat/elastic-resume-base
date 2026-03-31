# Changelog — @elastic-resume-base/toolbox (TypeScript)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note:** Toolbox is consumed as plain TypeScript source (not a compiled npm package).
> Services access it via the `@shared/toolbox` TypeScript path alias. Version numbers
> here reflect the state of the source files at a point in time and are used for
> change-tracking purposes only.

---

## [1.1.0] — 2026-03-31

### Added

- `createCorrelationIdHook(logger?)` — factory that creates a Fastify `onRequest` hook
  for correlation-ID and Cloud Trace context propagation. When an optional `logger` is
  provided the hook emits `warn`-level entries whenever the incoming request is missing
  the `x-correlation-id` or `x-cloud-trace-context` header. Use this in every service
  so that missing tracing headers are surfaced at the source rather than silently ignored.

### Changed

- `correlationIdHook` now also resolves and attaches `request.traceId` and
  `request.spanId` from the incoming `x-cloud-trace-context` header
  (`TRACE_ID/SPAN_ID;o=FLAG` format).  When the header is absent or malformed the
  trace ID is derived from the correlation ID (UUID without hyphens → 32 hex chars) and
  the span ID defaults to `"0"`.
- The `x-cloud-trace-context` response header is now echoed back on every response
  (previously only `x-correlation-id` was set).
- `correlationIdHook` is now a convenience alias for `createCorrelationIdHook()` (no
  logger, no warnings).  Existing consumers that use `correlationIdHook` directly are
  unaffected.

---

## [1.0.1] — 2026-03-30

## Added

Added `depthLevel` to the `loadConfigYaml` function to allow for loading Yaml files from deeper directories.


## [1.0.0] — 2026-03-28

### Added

**Fastify hooks**

- `correlationIdHook` — Fastify `onRequest` hook that reads or generates a
  `X-Correlation-ID` header and attaches it to `request.correlationId`.
- `createRequestLoggerHook(logger)` — factory that returns a Fastify `onRequest` hook
  that logs method, URL, and correlation ID for every incoming request.

**Error classes**

- `AppError` — base class for all domain errors; carries `statusCode: number` and
  `code: string`.
- `NotFoundError` (404), `UnauthorizedError` (401), `ValidationError` (400),
  `ConflictError` (409), `ForbiddenError` (403), `DownstreamError` (502),
  `UnavailableError` (503), `RateLimitError` (429) — all extend `AppError`.
- `isAppError(err: unknown): err is AppError` — type-safe predicate for `catch` blocks.

**Configuration**

- `loadConfigYaml<T>(path: string): T` — loads and validates a YAML configuration file,
  returning a strongly-typed object.

**Logging**

- `createLogger(name: string): Logger` — creates a `pino`-backed structured logger with
  correlation ID support.

**API types** (shared contract between TypeScript and Python services)

- Shared request / response types for Users API, Downloader, Search, File Generator,
  and Document Reader services; used to ensure identical wire shapes across languages.
