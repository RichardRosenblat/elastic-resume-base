"""HarborClient — object-oriented HTTP client for Elastic Resume Base Python services.

All outbound HTTP requests from Python microservices should be made through
:class:`HarborClient` instances to ensure consistent configuration and a stable
foundation for future cross-cutting concerns (correlation ID forwarding,
structured logging, retries, circuit breaking).

The :class:`HarborClient` class is the primary entry point.  For injection and
mocking, type-hint against :class:`IHarborClient` (the abstract interface).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import httpx


# ─── Interface ────────────────────────────────────────────────────────────────


class IHarborClient(ABC):
    """Abstract interface for Harbor HTTP clients.

    Program to this interface when accepting Harbor clients via dependency
    injection so that implementations (:class:`HarborClient`,
    :class:`IamHarborClient`) can be swapped or mocked freely.

    Example::

        from harbor_py.client import IHarborClient

        class UsersServiceClient:
            def __init__(self, client: IHarborClient) -> None:
                self._client = client

            async def list_users(self) -> list[dict[str, Any]]:
                response = await self._client.get("/api/v1/users")
                response.raise_for_status()
                return response.json()
    """

    @abstractmethod
    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a GET request."""

    @abstractmethod
    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a POST request."""

    @abstractmethod
    async def put(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a PUT request."""

    @abstractmethod
    async def patch(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a PATCH request."""

    @abstractmethod
    async def delete(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a DELETE request."""

    @abstractmethod
    async def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """Send an arbitrary HTTP request."""

    @abstractmethod
    async def aclose(self) -> None:
        """Close the underlying connection pool."""

    @abstractmethod
    async def __aenter__(self) -> "IHarborClient":
        """Enter async context manager."""

    @abstractmethod
    async def __aexit__(self, *args: Any) -> None:
        """Exit async context manager."""


# ─── Options ──────────────────────────────────────────────────────────────────


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


# ─── HarborClient ─────────────────────────────────────────────────────────────


class HarborClient(IHarborClient):
    """An object-oriented async HTTP client for communicating with a downstream service.

    ``HarborClient`` wraps :class:`httpx.AsyncClient` and pre-applies the
    options provided at construction time (base URL, timeout, default headers).
    It implements the :class:`IHarborClient` interface and the async context-
    manager protocol, ensuring the underlying connection pool is properly closed
    on exit.

    Inject it into service-specific client objects to keep each client
    independently testable and mockable.

    Example::

        from harbor_py import HarborClient

        client = HarborClient(HarborClientOptions(base_url="http://users-api:8005"))

        async with client as c:
            response = await c.get("/api/v1/users")
            users = response.json()
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

    @property
    def options(self) -> HarborClientOptions:
        """The options used to configure this client."""
        return self._options

    @property
    def httpx_client(self) -> httpx.AsyncClient:
        """The underlying httpx client (for advanced use such as adding event hooks)."""
        return self._client

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
