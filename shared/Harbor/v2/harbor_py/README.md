# elastic-resume-base-harbor v2 (Python)

**HarborClient v2** — Shared HTTP request abstraction for Elastic Resume Base Python services.

Version 2 adds an IAM-authenticated HTTP client (`IamHarborClient`) for service-to-service calls on Google Cloud Platform. The base client is unchanged from v1.

---

## What's new in v2

| Feature | v1 | v2 |
|---|---|---|
| `create_harbor_client` | ✅ | ✅ unchanged |
| `HarborClient` | ✅ | ✅ unchanged |
| `is_harbor_error` | ✅ | ✅ unchanged |
| `create_iam_harbor_client` | — | ✅ new |
| `IamHarborClient` | — | ✅ new |
| `IamHarborClientOptions` | — | ✅ new |

---

## Installation

```bash
# Development (editable install)
pip install -e ../shared/Harbor/v2/harbor_py

# Production
pip install ../shared/Harbor/v2/harbor_py
```

---

## API Reference

### `create_harbor_client(base_url, timeout_seconds=30.0, default_headers=None)`

*(Unchanged from v1)* Creates a pre-configured `HarborClient` for communicating with a downstream service.

```python
from harbor_py import create_harbor_client

client = create_harbor_client(
    base_url="http://document-reader:8004",
    timeout_seconds=30.0,
)

async with client as c:
    response = await c.get("/health")
```

### `create_iam_harbor_client(base_url, audience, timeout_seconds=30.0, default_headers=None)`

*(New in v2)* Creates an `IamHarborClient` that automatically attaches a Google Cloud
OIDC identity token to every outgoing request using Application Default Credentials (ADC).
Use this for service-to-service calls where the receiving service requires Cloud Run IAM
authentication.

```python
from harbor_py import create_iam_harbor_client

client = create_iam_harbor_client(
    base_url="https://users-api.run.app",
    audience="https://users-api.run.app",  # OIDC audience = service URL
    timeout_seconds=30.0,
)

async with client as c:
    response = await c.get("/api/v1/users")
```

### `is_harbor_error(err)`

*(Unchanged from v1)* Returns `True` if the exception originated from a `HarborClient`
or `IamHarborClient` request (i.e. any `httpx.HTTPError` subclass).

```python
from harbor_py import is_harbor_error
import httpx

try:
    response = await client.post("/endpoint", json=payload)
    response.raise_for_status()
except BaseException as err:
    if is_harbor_error(err):
        if isinstance(err, httpx.TimeoutException):
            raise UnavailableError("Service timed out") from err
        raise DownstreamError("Unexpected response from service") from err
    raise
```

### `IamHarborClientOptions`

Dataclass extending `HarborClientOptions` with the `audience` field:

```python
from harbor_py import IamHarborClientOptions, IamHarborClient

options = IamHarborClientOptions(
    base_url="https://users-api.run.app",
    audience="https://users-api.run.app",
    timeout_seconds=15.0,
)
client = IamHarborClient(options)
```

---

## Building / Testing

```bash
cd shared/Harbor/v2/harbor_py

# Install dev dependencies
pip install -r requirements-dev.txt

# Run tests
pytest
```

---

## Migration from v1

All v1 imports continue to work unchanged. To add IAM authentication to service-to-service
calls, replace `create_harbor_client` with `create_iam_harbor_client` and provide the
`audience` parameter:

```python
# Before (v1)
client = create_harbor_client(base_url=config.users_api_url)

# After (v2, with IAM auth)
client = create_iam_harbor_client(
    base_url=config.users_api_url,
    audience=config.users_api_url,
)
```
