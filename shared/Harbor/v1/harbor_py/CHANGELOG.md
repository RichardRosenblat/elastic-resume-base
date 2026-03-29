# Changelog — elastic-resume-base-harbor (Python)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2024-01-01

### Added

- `create_harbor_client(base_url, timeout_seconds=30.0, headers=None)` — factory that
  creates a pre-configured async `httpx`-backed HTTP client; mirrors `createHarborClient`
  from the TypeScript package.
- `HarborClient` class — async context-manager HTTP client exposing `get`, `post`, `put`,
  `patch`, and `delete` methods.
- `HarborClientOptions` dataclass — `base_url: str`, `timeout_seconds: float`,
  `headers: dict[str, str] | None`.
- `is_harbor_error(err: BaseException) -> bool` — type-safe predicate that returns `True`
  when the exception originates from an httpx request; mirrors `isHarborError` from the
  TypeScript package.
