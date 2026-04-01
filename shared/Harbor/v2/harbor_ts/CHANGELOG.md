# Changelog — @elastic-resume-base/harbor (v2)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] — 2026-04-01

### Added

- **`./client` sub-path export** — browser-safe entry point that exposes only the
  basic HTTP client factory. Contains no Node.js-only dependencies.
  - `createHarborClient(options: HarborClientOptions): HarborClient`
  - `isHarborError(err: unknown): boolean`
- **`./server` sub-path export** — server-side entry point for Node.js services.
  - All exports from `./client`
  - `createIamHarborClient(options: IamHarborClientOptions): HarborClient` — factory
    that automatically attaches a Google Cloud OIDC identity token to every request
    for service-to-service IAM authentication.
  - `IamHarborClientOptions` type — extends `HarborClientOptions` with `audience: string`
- **`google-auth-library`** added as a production dependency (server module only).

### Breaking Changes

- **No main `.` export** — Harbor v2 has no root package export. Consuming services
  must use the explicit `./client` or `./server` sub-path.
  Replace `import { ... } from '@elastic-resume-base/harbor'` with either
  `import { ... } from '@elastic-resume-base/harbor/server'` (Node.js services) or
  `import { ... } from '@elastic-resume-base/harbor/client'` (browser / frontend).

### Migration from v1

| Old import (v1) | New import (v2) |
|---|---|
| `from '@elastic-resume-base/harbor'` | `from '@elastic-resume-base/harbor/server'` (Node.js services) |
| `from '@elastic-resume-base/harbor'` | `from '@elastic-resume-base/harbor/client'` (browser code) |

---

## v1 history

See `shared/Harbor/v1/harbor_ts/CHANGELOG.md`.
