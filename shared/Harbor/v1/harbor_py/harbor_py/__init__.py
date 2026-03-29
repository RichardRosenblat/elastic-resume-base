"""HarborClient — HTTP request abstraction for Elastic Resume Base Python services.

Mirrors the TypeScript ``@elastic-resume-base/harbor`` package so that all
Python services share the same HTTP client infrastructure and error detection
vocabulary as the Node.js services.

Quick start::

    from harbor_py import create_harbor_client, is_harbor_error

    client = create_harbor_client(base_url="http://users-api:8005", timeout_seconds=30.0)

    async with client as c:
        response = await c.get("/api/v1/users")

Error handling::

    from harbor_py import is_harbor_error
    import httpx

    try:
        response = await client.post("/endpoint", json=payload)
    except Exception as err:
        if is_harbor_error(err):
            # err is an httpx.HTTPError or httpx.TimeoutException
            pass
"""

from harbor_py.client import HarborClient, HarborClientOptions, create_harbor_client
from harbor_py.errors import is_harbor_error

__all__ = [
    "HarborClient",
    "HarborClientOptions",
    "create_harbor_client",
    "is_harbor_error",
]
