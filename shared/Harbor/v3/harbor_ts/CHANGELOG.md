# Changelog — @elastic-resume-base/harbor (v3)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] — 2026-04-03

### Added

- **Object-oriented `HarborClient` class** — replaces the `HarborClient` type alias
  (previously `AxiosInstance`) with a proper, instantiable class. Accepts
  `HarborClientOptions` in the constructor and exposes `get`, `post`, `put`, `patch`,
  `delete`, `request` methods plus an `axiosInstance` property for interceptor access.
- **`IHarborClient` interface** — defines the common HTTP contract for all Harbor
  client classes. Program to this interface when accepting clients via injection so
  that implementations can be swapped or mocked freely.
- **`IamHarborClient` class** *(server module)* — extends `HarborClient` and
  automatically attaches a Google Cloud OIDC identity token to every outgoing request
  for IAM-based service-to-service authentication.
- **`ServerHarborClient` class** *(server module)* — extends `HarborClient` and
  selects the right transport based on `NODE_ENV`: plain HTTP in development, IAM
  in production.
- **`HarborManager` class** *(client & server modules)* — a registry that can
  register, retrieve, and manage the lifecycle of multiple named `HarborClient`
  instances.  Methods: `registerClient`, `getClient`, `hasClient`,
  `unregisterClient`, `clear`, `registeredKeys`, `size`.
- **`ServiceClient` abstract base class** — base for service-specific client objects.
  Accepts an `IHarborClient` via constructor injection for clean testability.
- **`GatewayServiceClient`** *(client module)* — client-side service client for the
  Gateway API.  Delegates all HTTP calls to the injected `IHarborClient`.
- **`UsersServiceClient`** *(server module)* — server-side service client for the
  Users API.  Delegates all HTTP calls to the injected `IHarborClient`.
- **`DocumentReaderServiceClient`** *(server module)* — server-side service client for
  the Document Reader API.  Delegates all HTTP calls to the injected `IHarborClient`.

### Changed

- Package version bumped to `3.0.0`.
- `HarborClient` is now a **class** (not a type alias for `AxiosInstance`).  The
  `IHarborClient` interface is provided for injection points.

### Breaking Changes from v2

- `HarborClient` is no longer a type alias for `AxiosInstance`.  If you need the raw
  Axios instance, access it via `client.axiosInstance`.
- Factory functions (`createHarborClient`, `createIamHarborClient`,
  `createServerHarborClient`) are **not exported** from v3.  Use `new HarborClient()`,
  `new IamHarborClient()`, `new ServerHarborClient()` instead.
- v1 and v2 remain available at their existing paths.  The procedural factory
  interface in v1 and v2 is **deprecated** but kept for backward compatibility.

### Migration from v2

```typescript
// v2 (procedural):
import { createHarborClient } from '@elastic-resume-base/harbor/server';
const client = createHarborClient({ baseURL: config.usersApiUrl });

// v3 (object-oriented):
import { HarborClient } from '@elastic-resume-base/harbor/server';
const client = new HarborClient({ baseURL: config.usersApiUrl });
```

---

## Previous versions

- See [v2 CHANGELOG](../../v2/harbor_ts/CHANGELOG.md) for v2 release history.
- See [v1 CHANGELOG](../../v1/harbor_ts/CHANGELOG.md) for v1 release history.
