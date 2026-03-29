# Changelog — @elastic-resume-base/toolbox (TypeScript)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note:** Toolbox is consumed as plain TypeScript source (not a compiled npm package).
> Services access it via the `@shared/toolbox` TypeScript path alias. Version numbers
> here reflect the state of the source files at a point in time and are used for
> change-tracking purposes only.

---

## [1.0.0] — 2024-01-01

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
