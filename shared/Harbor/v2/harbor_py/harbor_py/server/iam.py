"""IAM-authenticated HTTP client for service-to-service communication.

This module provides an HTTP client that automatically attaches a Google Cloud
OIDC identity token to every outgoing request, enabling Cloud Run
service-to-service authentication without any per-service boilerplate.

Authentication relies on Application Default Credentials (ADC): on GCP the
Compute Engine / Cloud Run service account is used automatically.  In local
development, ADC falls back to ``gcloud auth application-default login``.

**Server-only** — this module requires ``google-auth`` and should never be
used in browser code.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import httpx
import google.auth.transport.requests
import google.oauth2.id_token

from harbor_py.client import HarborClientOptions


# ─── Types ────────────────────────────────────────────────────────────────────


@dataclass
class IamHarborClientOptions(HarborClientOptions):
    """Configuration options for creating an IAM-authenticated
    :class:`IamHarborClient`.

    Extends :class:`~harbor_py.HarborClientOptions` with the required
    ``audience`` field used to obtain a Google Cloud OIDC identity token.

    Attributes:
        audience: The IAM OIDC audience.  For Cloud Run services this is
            typically the service's HTTPS URL, e.g.
            ``https://my-service-hash-uc.a.run.app``.
    """

    audience: str = field(default="")

    def __post_init__(self) -> None:
        if not self.audience:
            raise ValueError("IamHarborClientOptions.audience must be set")


# ─── IAM client ───────────────────────────────────────────────────────────────


class IamHarborClient:
    """An async HTTP client that automatically attaches a Google Cloud OIDC
    identity token to every outgoing request.

    Use this client for **service-to-service** calls where the receiving
    service requires IAM authentication (e.g. Cloud Run services with ingress
    set to "internal" or "internal + load balancer").

    Example::

        from harbor_py import create_iam_harbor_client

        client = create_iam_harbor_client(
            base_url=config.users_api_url,
            audience=config.users_api_url,
            timeout_seconds=30.0,
        )

        async with client as c:
            response = await c.get("/api/v1/users")
    """

    def __init__(self, options: IamHarborClientOptions) -> None:
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
            event_hooks={"request": [self._attach_iam_token]},
        )

    async def _attach_iam_token(self, request: httpx.Request) -> None:
        """Event hook that fetches and attaches an OIDC identity token."""
        try:
            auth_req = google.auth.transport.requests.Request()
            token = google.oauth2.id_token.fetch_id_token(
                auth_req, self._options.audience
            )
            request.headers["Authorization"] = f"Bearer {token}"
        except Exception:  # noqa: BLE001
            # If IAM token acquisition fails, let the request proceed without
            # the token — the downstream service will return 401/403, which
            # surfaces the misconfiguration more clearly than swallowing the
            # error silently.
            pass

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a GET request."""
        return await self._client.get(url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a POST request."""
        return await self._client.post(url, **kwargs)

    async def put(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a PUT request."""
        return await self._client.put(url, **kwargs)

    async def patch(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a PATCH request."""
        return await self._client.patch(url, **kwargs)

    async def delete(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a DELETE request."""
        return await self._client.delete(url, **kwargs)

    async def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """Send an arbitrary HTTP request."""
        return await self._client.request(method, url, **kwargs)

    async def aclose(self) -> None:
        """Close the underlying connection pool and release resources."""
        await self._client.aclose()

    async def __aenter__(self) -> "IamHarborClient":
        await self._client.__aenter__()
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self._client.__aexit__(*args)


def create_iam_harbor_client(
    base_url: str,
    audience: str,
    timeout_seconds: float | None = 30.0,
    default_headers: dict[str, str] | None = None,
) -> IamHarborClient:
    """Create an IAM-authenticated :class:`IamHarborClient` for service-to-service calls.

    .. deprecated::
        The procedural factory interface (``create_iam_harbor_client``) is deprecated.
        Use the object-oriented :class:`~harbor_py.server.IamHarborClient` class from
        ``elastic-resume-base-harbor`` v3 instead::

            from harbor_py.server import IamHarborClient, IamHarborClientOptions  # v3
            client = IamHarborClient(IamHarborClientOptions(base_url="...", audience="..."))

        This v2 export will be removed in a future major version.

    The returned client automatically attaches a Google Cloud OIDC identity
    token to every outgoing request using Application Default Credentials (ADC).

    Args:
        base_url: Base URL prepended to every request path.
        audience: The IAM OIDC audience.  For Cloud Run this is the service
            HTTPS URL, e.g. ``https://my-service-hash-uc.a.run.app``.
        timeout_seconds: Per-request timeout in seconds.  Pass ``None`` to
            disable. Defaults to ``30.0``.
        default_headers: Headers attached to every outgoing request.

    Returns:
        A configured :class:`IamHarborClient` instance.

    Example::

        client = create_iam_harbor_client(
            base_url=config.users_api_url,
            audience=config.users_api_url,
        )
        async with client as c:
            resp = await c.get("/api/v1/users")
    """
    return IamHarborClient(
        IamHarborClientOptions(
            base_url=base_url,
            audience=audience,
            timeout_seconds=timeout_seconds,
            default_headers=default_headers or {},
        )
    )
