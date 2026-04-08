# elastic-resume-base-harbor (v3, Python)

**HarborClient** — Shared HTTP request abstraction (object-oriented interface) for
Elastic Resume Base Python microservices.

Version 3 transitions from the procedural factory-function interface of v1/v2 to a
fully **object-oriented class-based interface**.  Clients are proper classes that can be
instantiated, extended, and injected via constructors — making every layer of the stack
independently testable and mockable.

---

## Quick Start — basic client

```python
from harbor_py import HarborClient, HarborClientOptions

client = HarborClient(HarborClientOptions(base_url="http://users-api:8005"))

async with client as c:
    response = await c.get("/api/v1/users")
    users = response.json()
```

---

## Quick Start — HarborManager (multiple clients)

```python
from harbor_py import HarborManager, HarborClientOptions

manager = HarborManager()

# Register clients during startup:
manager.register_client("users", HarborClientOptions(base_url="http://users-api:8005"))
manager.register_client("search", HarborClientOptions(base_url="http://search:8002"))

# Retrieve anywhere:
users_client = manager.get_client("users")
```

---

## Quick Start — IAM-authenticated client (server)

```python
from harbor_py.server import IamHarborClient, IamHarborClientOptions

client = IamHarborClient(IamHarborClientOptions(
    base_url="https://users-api.run.app",
    audience="https://users-api.run.app",
))

async with client as c:
    response = await c.get("/api/v1/users")
```

---

## Quick Start — environment-aware client (server, recommended)

```python
from harbor_py.server import ServerHarborClient, ServerHarborClientOptions

# Uses plain httpx in development, IAM-authenticated in production.
client = ServerHarborClient(ServerHarborClientOptions(base_url=config.users_api_url))

async with client as c:
    response = await c.get("/api/v1/users")
```

---

## Quick Start — service clients with injection

```python
from harbor_py.server import ServerHarborClient, ServerHarborClientOptions
from harbor_py.services.server import UsersServiceClient, DocumentReaderServiceClient

users_harbor = ServerHarborClient(ServerHarborClientOptions(base_url=config.users_api_url))
doc_harbor = ServerHarborClient(ServerHarborClientOptions(base_url=config.doc_reader_url))

users = UsersServiceClient(users_harbor)
doc_reader = DocumentReaderServiceClient(doc_harbor)

response = await users.get("/api/v1/users")
doc = await doc_reader.post("/read", json={"fileReference": "gs://bucket/file.pdf"})
```

---

## Testing with mocks

Because every service client accepts `IHarborClient` via injection, swap in a mock
without any additional test setup:

```python
from unittest.mock import AsyncMock, MagicMock
from harbor_py.services.server import UsersServiceClient

mock_harbor = MagicMock()
mock_harbor.get = AsyncMock(return_value=MagicMock(status_code=200, json=lambda: [{"id": "u1"}]))

users = UsersServiceClient(mock_harbor)
result = await users.get("/api/v1/users")
assert result.status_code == 200
```

---

## API Reference

### `IHarborClient` (abstract class)

Abstract interface for Harbor HTTP clients.  Type-hint against this when accepting
clients via injection.

**Abstract methods:** `get`, `post`, `put`, `patch`, `delete`, `request`, `aclose`,
`__aenter__`, `__aexit__`

---

### `HarborClient` (class)

Implements `IHarborClient`.  A configurable async HTTP client wrapping `httpx.AsyncClient`.

**Constructor:** `HarborClient(options: HarborClientOptions)`

**Properties:** `options`, `httpx_client`

**Methods:** `get`, `post`, `put`, `patch`, `delete`, `request`, `aclose`

---

### `HarborClientOptions` (dataclass)

| Field | Type | Default | Description |
|---|---|---|---|
| `base_url` | `str` | required | Base URL for all requests. |
| `timeout_seconds` | `float \| None` | `30.0` | Request timeout. `None` to disable. |
| `default_headers` | `dict[str, str]` | `{}` | Headers attached to every request. |

---

### `IamHarborClient` (class) *(server)*

Extends `HarborClient`. Automatically attaches a Google Cloud OIDC identity token.

**Constructor:** `IamHarborClient(options: IamHarborClientOptions)`

---

### `IamHarborClientOptions` (dataclass) *(server)*

Extends `HarborClientOptions` with required `audience: str`.

---

### `ServerHarborClient` (class) *(server)*

Extends `HarborClient`. In development, plain HTTP; in production (`NODE_ENV == "production"`),
IAM-authenticated.

**Constructor:** `ServerHarborClient(options: ServerHarborClientOptions)`

---

### `ServerHarborClientOptions` (dataclass) *(server)*

Extends `HarborClientOptions` with optional `audience: str | None = None`.

---

### `HarborManager` (class)

Registry for managing multiple named `HarborClient` instances.

**Methods:** `register_client(key, options)`, `get_client(key)`, `has_client(key)`,
`unregister_client(key)`, `clear()`

**Properties:** `registered_keys`, `size`

---

### `ServiceClient` (abstract class)

Base class for service-specific HTTP clients. Accepts `IHarborClient` via injection.

**Attribute:** `client: IHarborClient`

---

### `GatewayServiceClient` (class) *(client)*

Service client for the Gateway API. Delegates to the injected `IHarborClient`.

---

### `UsersServiceClient` (class) *(server)*

Service client for the Users API. Delegates to the injected `IHarborClient`.

---

### `DocumentReaderServiceClient` (class) *(server)*

Service client for the Document Reader API. Delegates to the injected `IHarborClient`.

---

### `is_harbor_error(err)` (function)

Returns `True` if `err` is an `httpx.HTTPError` (network failure, timeout, etc.).

---

## Migration from v2

| v2 (procedural) | v3 (object-oriented) |
|---|---|
| `create_harbor_client(base_url=...)` | `HarborClient(HarborClientOptions(base_url=...))` |
| `create_iam_harbor_client(base_url=..., audience=...)` | `IamHarborClient(IamHarborClientOptions(base_url=..., audience=...))` |
| `create_server_harbor_client(base_url=...)` | `ServerHarborClient(ServerHarborClientOptions(base_url=...))` |

> **Note:** v1 and v2 remain available for backward compatibility. Their procedural
> factory functions are deprecated — see each version's CHANGELOG for details.
