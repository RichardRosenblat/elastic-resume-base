"""Environment-aware HTTP client factory for server-side use.

Selects the underlying transport based on the ``NODE_ENV`` environment variable
so that callers never need to branch on the environment themselves:

- **development** (default when ``NODE_ENV`` is absent or not ``"production"``)
  — uses a plain :class:`~harbor_py.client.HarborClient` backed by ``httpx``.
- **production** (``NODE_ENV == "production"``) — uses an
  :class:`~harbor_py.server.iam.IamHarborClient` that automatically attaches a
  Google Cloud OIDC identity token to every outgoing request, enabling secure
  service-to-service calls on Google Cloud Run.

**Server-only** — this module should never be used in browser code.
"""

from __future__ import annotations

import os

from harbor_py.client import HarborClient, create_harbor_client
from harbor_py.server.iam import IamHarborClient, create_iam_harbor_client

# ─── Type alias ───────────────────────────────────────────────────────────────

#: Return type of :func:`create_server_harbor_client`.  In development this is
#: a plain :class:`~harbor_py.client.HarborClient`; in production an
#: :class:`~harbor_py.server.iam.IamHarborClient`.  Both expose the same
#: async HTTP interface so callers can use either transparently.
ServerHarborClient = HarborClient | IamHarborClient


# ─── Factory ──────────────────────────────────────────────────────────────────


def create_server_harbor_client(
    base_url: str,
    audience: str | None = None,
    timeout_seconds: float | None = 30.0,
    default_headers: dict[str, str] | None = None,
) -> ServerHarborClient:
    """Create an environment-aware HTTP client for server-side service calls.

    The underlying transport is chosen automatically based on ``NODE_ENV``:

    - In **development** (default): plain ``httpx`` client — no authentication
      overhead.
    - In **production**: IAM-authenticated ``httpx`` client — attaches a
      Google Cloud OIDC identity token to every request.

    Callers use the returned client identically in both environments::

        client = create_server_harbor_client(base_url=config.users_api_url)

        async with client as c:
            response = await c.get("/api/v1/users")

    Args:
        base_url: Base URL prepended to every request path.
        audience: IAM OIDC audience used in production mode.  For Cloud Run
            services this is typically the service's HTTPS URL, e.g.
            ``https://my-service-hash-uc.a.run.app``.  When omitted,
            ``base_url`` is used as the audience.  Has no effect in
            development mode.
        timeout_seconds: Per-request timeout in seconds.  Pass ``None`` to
            disable.  Defaults to ``30.0``.
        default_headers: Headers attached to every outgoing request.

    Returns:
        A :class:`ServerHarborClient` (either :class:`~harbor_py.client.HarborClient`
        or :class:`~harbor_py.server.iam.IamHarborClient`) ready for use.
    """
    if os.environ.get("NODE_ENV") == "production":
        return create_iam_harbor_client(
            base_url=base_url,
            audience=audience or base_url,
            timeout_seconds=timeout_seconds,
            default_headers=default_headers,
        )

    return create_harbor_client(
        base_url=base_url,
        timeout_seconds=timeout_seconds,
        default_headers=default_headers,
    )
