# Changelog — @elastic-resume-base/aegis (v2)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] — 2026-04-01

### Added

- **`./server` sub-path export** — explicit server-side entry point that exposes all
  server-only authentication exports. Consuming services should import from
  `@elastic-resume-base/aegis/server` to make the trust boundary visible at the import
  level.
- **`RequestContext` interface** (exported from `./server`) — unified, provider-agnostic
  representation of an authenticated request context derived from server-side token
  verification. Fields: `uid`, `email?`, `name?`, `picture?`.

### Changed

- The package **default export** (`.`) now maps to the server module (`./server`). This
  is a compatible alias kept for backwards convenience; new code should use
  `./server` or `./client` explicitly.

### Breaking Changes

- **Removed the mixed barrel `src/index.ts`** — the main package root (`.`) previously
  re-exported both server-side (firebase-admin) and client-side (firebase/app) symbols
  from a single barrel. In v2 these are strictly separated: `./server` contains only
  server-side code and `./client` contains only client-side code.
- **`./server` is a new required import path** for all services performing token
  verification. Replace `import { ... } from '@elastic-resume-base/aegis'` with
  `import { ... } from '@elastic-resume-base/aegis/server'`.

### Migration from v1

| Old import (v1) | New import (v2) |
|---|---|
| `from '@elastic-resume-base/aegis'` | `from '@elastic-resume-base/aegis/server'` |
| `from '@elastic-resume-base/aegis/client'` | `from '@elastic-resume-base/aegis/client'` *(unchanged)* |

---

## v1 history

See `shared/Aegis/v1/aegis_ts/CHANGELOG.md`.
