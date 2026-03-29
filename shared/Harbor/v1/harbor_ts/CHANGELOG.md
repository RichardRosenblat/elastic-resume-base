# Changelog — @elastic-resume-base/harbor

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-01-01

### Added

- `createHarborClient(options: HarborClientOptions): HarborClient` — factory that creates
  a pre-configured Axios-backed HTTP client.
- `HarborClientOptions` type — `{ baseURL: string; timeoutMs?: number; headers?: Record<string, string> }`.
- `HarborClient` interface — typed wrapper exposing `get`, `post`, `put`, `patch`, and
  `delete` methods with full TypeScript generics.
- `isHarborError(err: unknown): boolean` — type-safe predicate that returns `true` when
  the error originated from an Axios request (replaces `axios.isAxiosError` in consuming
  services so they need no direct Axios dependency).
