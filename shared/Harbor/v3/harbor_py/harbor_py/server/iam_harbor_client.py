"""IAM-authenticated HTTP client for service-to-service communication (v3).

This module provides an object-oriented HTTP client that automatically attaches
a Google Cloud OIDC identity token to every outgoing request, enabling Cloud Run
service-to-service authentication without any per-service boilerplate.

**Server-only** — requires ``google-auth`` and should never be used in browser code.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import httpx
import google.auth.transport.requests
import google.oauth2.id_token

from harbor_py.client.harbor_client import HarborClient, HarborClientOptions


# ─── Options ──────────────────────────────────────────────────────────────────


@dataclass
class IamHarborClientOptions(HarborClientOptions):
    """Configuration options for :class:`IamHarborClient`.

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


# ─── IamHarborClient ──────────────────────────────────────────────────────────


class IamHarborClient(HarborClient):
    """An async HTTP client that automatically attaches a Google Cloud OIDC
    identity token to every outgoing request.

    Extends :class:`HarborClient` and registers an httpx event hook to fetch
    and attach the OIDC token before each request is sent.

    Use this client for **service-to-service** calls where the receiving
    service requires IAM authentication (e.g. Cloud Run services with ingress
    set to "internal" or "internal + load balancer").

    Example::

        from harbor_py.server import IamHarborClient, IamHarborClientOptions

        client = IamHarborClient(IamHarborClientOptions(
            base_url="https://users-api.run.app",
            audience="https://users-api.run.app",
        ))

        async with client as c:
            response = await c.get("/api/v1/users")
    """

    def __init__(self, options: IamHarborClientOptions) -> None:
        # We build the httpx client ourselves so we can register the event hook.
        # Intentionally not calling super().__init__() and then swapping out
        # the client — instead we replicate the setup to keep things clear.
        self._options: HarborClientOptions = options
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
            iam_options = self._options
            # audience is guaranteed by IamHarborClientOptions.__post_init__
            audience = getattr(iam_options, "audience", "")
            token = google.oauth2.id_token.fetch_id_token(auth_req, audience)
            request.headers["Authorization"] = f"Bearer {token}"
        except Exception:  # noqa: BLE001
            # If IAM token acquisition fails, let the request proceed without
            # the token — the downstream service will return 401/403, which
            # surfaces the misconfiguration more clearly than swallowing it.
            pass
