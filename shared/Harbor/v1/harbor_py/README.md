# elastic-resume-base-harbor (Python)

**HarborClient** — Shared HTTP request abstraction for Elastic Resume Base Python services.

Mirrors the TypeScript `@elastic-resume-base/harbor` package so that all Python services share the same HTTP client infrastructure. All outbound HTTP requests from Python microservices should be made through `HarborClient` instances.

---

## Installation

```bash
# Development (editable install)
pip install -e ../shared/Harbor/harbor_py

# Production
pip install ../shared/Harbor/harbor_py
```

---

## API Reference

### `create_harbor_client(base_url, timeout_seconds=30.0, default_headers=None)`

Creates a pre-configured `HarborClient` for communicating with a downstream service.

```python
from harbor_py import create_harbor_client

client = create_harbor_client(
    base_url="http://document-reader:8004",
    timeout_seconds=30.0,
)

async with client as c:
    response = await c.post("/read", json={"fileReference": "gs://bucket/file.pdf"})
    data = response.json()
```

### `is_harbor_error(err)`

Returns `True` if the exception originated from a `HarborClient` request (i.e. any `httpx.HTTPError` subclass). Use this guard in `except` blocks to identify HTTP errors before mapping them to domain-specific types.

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

### `HarborClientOptions`

Dataclass holding configuration for `HarborClient`:

```python
from harbor_py import HarborClientOptions, HarborClient

options = HarborClientOptions(
    base_url="http://users-api:8005",
    timeout_seconds=15.0,
    default_headers={"x-internal-token": "secret"},
)
client = HarborClient(options)
```

---

## Building / Testing

```bash
cd shared/Harbor/harbor_py

# Install dev dependencies
pip install -r requirements-dev.txt
pip install -e .

# Run tests
pytest
```
