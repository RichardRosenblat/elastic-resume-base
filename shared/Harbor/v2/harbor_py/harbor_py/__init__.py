"""HarborClient v2 — HTTP request abstraction for Elastic Resume Base Python services.

Version 2 extends the v1 HarborClient with an IAM-authenticated client for
service-to-service calls on Google Cloud Platform.  The base client is
unchanged from v1.

Quick start (basic client — same as v1)::

    from harbor_py import create_harbor_client, is_harbor_error

    client = create_harbor_client(base_url="http://users-api:8005", timeout_seconds=30.0)

    async with client as c:
        response = await c.get("/api/v1/users")

Quick start (IAM-authenticated client — new in v2)::

    from harbor_py import create_iam_harbor_client

    client = create_iam_harbor_client(
        base_url="https://users-api.run.app",
        audience="https://users-api.run.app",
        timeout_seconds=30.0,
    )

    async with client as c:
        response = await c.get("/api/v1/users")

Quick start (environment-aware client — recommended for most services)::

    from harbor_py import create_server_harbor_client

    # Automatically uses plain httpx in development and IAM auth in production.
    client = create_server_harbor_client(base_url=config.users_api_url)

    async with client as c:
        response = await c.get("/api/v1/users")
"""

# ─── Client exports ────────────────────────────────────────────────────────────
from harbor_py.client import (
    HarborClient,
    HarborClientOptions,
    create_harbor_client,
    is_harbor_error,
)

# ─── Server exports — environment-aware client ────────────────────────────────
from harbor_py.server.env import ServerHarborClient, create_server_harbor_client

# ─── Server exports — IAM-authenticated client ────────────────────────────────
from harbor_py.server.iam import IamHarborClient, IamHarborClientOptions, create_iam_harbor_client

__all__ = [
    # client exports
    "HarborClient",
    "HarborClientOptions",
    "create_harbor_client",
    "is_harbor_error",
    # server exports — IAM-authenticated
    "IamHarborClient",
    "IamHarborClientOptions",
    "create_iam_harbor_client",
    # server exports — environment-aware
    "ServerHarborClient",
    "create_server_harbor_client",
]

