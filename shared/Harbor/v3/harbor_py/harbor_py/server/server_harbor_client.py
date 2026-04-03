"""Environment-aware HTTP client for server-side use (v3).

Selects the underlying transport based on the ``NODE_ENV`` environment variable
so that callers never need to branch on the environment themselves:

- **development** (default) — a plain :class:`~harbor_py.HarborClient`.
- **production** (``NODE_ENV == "production"``) — an
  :class:`~harbor_py.server.IamHarborClient` that automatically attaches a
  Google Cloud OIDC identity token to every outgoing request.

**Server-only** — should never be used in browser code.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from harbor_py.client.harbor_client import HarborClient, HarborClientOptions
from harbor_py.server.iam_harbor_client import IamHarborClient, IamHarborClientOptions


@dataclass
class ServerHarborClientOptions(HarborClientOptions):
    """Configuration options for :class:`ServerHarborClient`.

    Extends :class:`~harbor_py.HarborClientOptions` with an optional
    ``audience`` field that is only used in production.

    Attributes:
        audience: IAM OIDC audience used in production mode.  For Cloud Run
            services this is typically the service's HTTPS URL.  When omitted,
            ``base_url`` is used as the audience.  Has no effect in development.
    """

    audience: str | None = field(default=None)


class ServerHarborClient(HarborClient):
    """An environment-aware HTTP client that selects the right transport based on
    ``NODE_ENV``.

    - In **development** (default): behaves as a plain :class:`HarborClient`.
    - In **production** (``NODE_ENV == "production"``): behaves as an
      :class:`IamHarborClient`, attaching a Google Cloud OIDC identity token
      to every outgoing request.

    Callers use the returned client identically in both environments::

        from harbor_py.server import ServerHarborClient, ServerHarborClientOptions

        client = ServerHarborClient(ServerHarborClientOptions(
            base_url=config.users_api_url,
        ))

        async with client as c:
            response = await c.get("/api/v1/users")

    **Server-only** — requires Node.js-style environment variable conventions.
    """

    def __init__(self, options: ServerHarborClientOptions) -> None:
        if os.environ.get("NODE_ENV") == "production":
            iam_options = IamHarborClientOptions(
                base_url=options.base_url,
                timeout_seconds=options.timeout_seconds,
                default_headers=options.default_headers,
                audience=options.audience or options.base_url,
            )
            iam_client = IamHarborClient(iam_options)
            # Use the IAM-equipped httpx client for all subsequent calls.
            self._options = iam_options
            self._client = iam_client._client  # noqa: SLF001
        else:
            super().__init__(options)

