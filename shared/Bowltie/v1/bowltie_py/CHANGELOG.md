# Changelog — elastic-resume-base-bowltie (Python)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-01-01

### Added

- `format_success(data, correlation_id=None)` — wraps any payload in the standard success
  envelope; mirrors `formatSuccess` from the TypeScript package.
- `format_error(code, message, correlation_id=None)` — wraps an error code and message in
  the standard error envelope; mirrors `formatError` from the TypeScript package.
- `SuccessResponse[T]` generic TypedDict — `{ "success": True, "data": T, "meta": ResponseMeta }`.
- `ErrorResponse` TypedDict — `{ "success": False, "error": { "code": str, "message": str }, "meta": ResponseMeta }`.
- `ApiResponse[T]` union type alias — `SuccessResponse[T] | ErrorResponse`.
- `ResponseMeta` TypedDict — `{ "timestamp": str, "correlationId": str | None }`.
