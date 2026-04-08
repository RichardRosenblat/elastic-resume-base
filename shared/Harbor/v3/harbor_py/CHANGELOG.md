# Changelog — elastic-resume-base-harbor v3 (Python)

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] — 2026-04-03

### Added

- **`IHarborClient` abstract interface** — defines the common async HTTP contract for all
  Harbor client classes.  Program to this interface when accepting clients via dependency
  injection so that implementations can be swapped or mocked freely.
- **`HarborClient` class** — object-oriented async HTTP client (same as v2 but now
  implements `IHarborClient` and exposes `options` and `httpx_client` properties for
  advanced access).
- **`HarborClientOptions` dataclass** — unchanged from v2.
- **`HarborManager` class** — registry for managing multiple named `HarborClient`
  instances.  Methods: `register_client`, `get_client`, `has_client`,
  `unregister_client`, `clear`, `registered_keys`, `size`.
- **`IamHarborClient` class** *(server)* — extends `HarborClient` and automatically
  attaches a Google Cloud OIDC identity token to every request (same behaviour as v2,
  now subclasses `HarborClient`).
- **`IamHarborClientOptions` dataclass** *(server)* — unchanged from v2.
- **`ServerHarborClient` class** *(server)* — extends `HarborClient` and selects the
  right transport based on `NODE_ENV`.
- **`ServerHarborClientOptions` dataclass** *(server)* — extends `HarborClientOptions`
  with optional `audience` field.
- **`ServiceClient` abstract base class** — base for service-specific client objects.
  Accepts an `IHarborClient` via constructor injection for clean testability.
- **`GatewayServiceClient`** *(client)* — client-side service client for the Gateway
  API.  Delegates all HTTP calls to the injected `IHarborClient`.
- **`UsersServiceClient`** *(server)* — server-side service client for the Users API.
  Delegates all HTTP calls to the injected `IHarborClient`.
- **`DocumentReaderServiceClient`** *(server)* — server-side service client for the
  Document Reader API.  Delegates all HTTP calls to the injected `IHarborClient`.

### Changed

- Package version bumped to `3.0.0`.
- `HarborClient` now implements `IHarborClient` and exposes additional `options` and
  `httpx_client` properties.

### Deprecated (v1 and v2)

- The procedural factory functions (`create_harbor_client`, `create_iam_harbor_client`,
  `create_server_harbor_client`) in v1 and v2 are **deprecated** but kept for backward
  compatibility.  They will be removed in a future major version.  Migrate to the v3
  class-based interface.

### Migration from v2

```python
# v2 (procedural):
from harbor_py import create_harbor_client
client = create_harbor_client(base_url=config.users_api_url)

# v3 (object-oriented):
from harbor_py import HarborClient, HarborClientOptions
client = HarborClient(HarborClientOptions(base_url=config.users_api_url))
```

---

## Previous versions

- See [v2 CHANGELOG](../../v2/harbor_py/CHANGELOG.md) for v2 release history.
- See [v1 CHANGELOG](../../v1/harbor_py/CHANGELOG.md) for v1 release history.
