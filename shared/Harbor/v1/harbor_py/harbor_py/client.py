"""HarborClient implementation for Python services.

All outbound HTTP requests from Python microservices should be made through
``HarborClient`` instances to ensure consistent configuration and a stable
foundation for future cross-cutting concerns (correlation ID forwarding,
structured logging, retries, circuit breaking).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import httpx


@dataclass
class HarborClientOptions:
    """Configuration options for creating a :class:`HarborClient` instance.

    Attributes:
        base_url: Base URL that is prepended to every request path.
        timeout_seconds: Request timeout in seconds.  Defaults to ``30.0``.
            Pass ``None`` to disable the timeout entirely.
        default_headers: Headers attached to every outgoing request.
    """

    base_url: str
    timeout_seconds: float | None = 30.0
    default_headers: dict[str, str] = field(default_factory=dict)


class HarborClient:
    """A configured async HTTP client for communicating with a downstream service.

    ``HarborClient`` wraps :class:`httpx.AsyncClient` and pre-applies the
    options provided at construction time (base URL, timeout, default headers).
    It implements the async context-manager protocol so it can be used with
    ``async with`` blocks, which ensures that the underlying connection pool is
    properly closed on exit.

    Example::

        from harbor_py import create_harbor_client

        client = create_harbor_client(
            base_url="http://document-reader:8004",
            timeout_seconds=30.0,
        )

        async with client as c:
            response = await c.get("/health")
            data = response.json()
    """

    def __init__(self, options: HarborClientOptions) -> None:
        self._options = options
        timeout = (
            httpx.Timeout(options.timeout_seconds)
            if options.timeout_seconds is not None
            else None
        )
        self._client = httpx.AsyncClient(
            base_url=options.base_url,
            timeout=timeout,
            headers=options.default_headers,
        )

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a GET request to *url*."""
        return await self._client.get(url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a POST request to *url*."""
        return await self._client.post(url, **kwargs)

    async def put(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a PUT request to *url*."""
        return await self._client.put(url, **kwargs)

    async def patch(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a PATCH request to *url*."""
        return await self._client.patch(url, **kwargs)

    async def delete(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a DELETE request to *url*."""
        return await self._client.delete(url, **kwargs)

    async def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """Send an arbitrary HTTP request."""
        return await self._client.request(method, url, **kwargs)

    async def aclose(self) -> None:
        """Close the underlying connection pool and release resources."""
        await self._client.aclose()

    async def __aenter__(self) -> "HarborClient":
        await self._client.__aenter__()
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self._client.__aexit__(*args)


def create_harbor_client(
    base_url: str,
    timeout_seconds: float | None = 30.0,
    default_headers: dict[str, str] | None = None,
) -> HarborClient:
    """Create a pre-configured :class:`HarborClient` for a downstream service.

    .. deprecated::
        The procedural factory interface (``create_harbor_client``) is deprecated.
        Use the object-oriented :class:`~harbor_py.HarborClient` class from
        ``elastic-resume-base-harbor`` v3 instead::

            from harbor_py import HarborClient, HarborClientOptions  # v3
            client = HarborClient(HarborClientOptions(base_url="..."))

        This v1 export will be removed in a future major version.

    Args:
        base_url: Base URL that is prepended to every request path.
        timeout_seconds: Per-request timeout in seconds.  Pass ``None`` to
            disable the timeout.  Defaults to ``30.0``.
        default_headers: Headers attached to every outgoing request.

    Returns:
        A configured :class:`HarborClient` instance.

    Example::

        client = create_harbor_client(
            base_url="http://search-service:8002",
            timeout_seconds=10.0,
        )
        async with client as c:
            resp = await c.post("/search", json={"query": "software engineer"})
    """
    return HarborClient(
        HarborClientOptions(
            base_url=base_url,
            timeout_seconds=timeout_seconds,
            default_headers=default_headers or {},
        )
    )
