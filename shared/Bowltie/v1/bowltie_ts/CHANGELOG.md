# Changelog — @elastic-resume-base/bowltie

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-01-01

### Added

- `formatSuccess<T>(data: T, correlationId?: string): SuccessResponse<T>` — wraps any
  payload in the standard success envelope.
- `formatError(code: string, message: string, correlationId?: string): ErrorResponse` —
  wraps an error code and message in the standard error envelope.
- `SuccessResponse<T>` type — `{ success: true; data: T; meta: ResponseMeta }`.
- `ErrorResponse` type — `{ success: false; error: { code: string; message: string }; meta: ResponseMeta }`.
- `ApiResponse<T>` type — union of `SuccessResponse<T>` and `ErrorResponse`.
- `ResponseMeta` type — `{ timestamp: string; correlationId?: string }`.
