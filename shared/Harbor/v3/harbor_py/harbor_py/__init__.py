"""HarborClient v3 — object-oriented HTTP request abstraction for Elastic Resume Base services.

Version 3 transitions from the procedural factory-function interface of v1/v2 to a
fully object-oriented class-based interface.  Clients are proper classes that can be
instantiated, extended, and injected via constructors.

Quick start (basic client)::

    from harbor_py import HarborClient, HarborClientOptions

    client = HarborClient(HarborClientOptions(base_url="http://users-api:8005"))

    async with client as c:
        response = await c.get("/api/v1/users")

Quick start (IAM-authenticated client)::

    from harbor_py.server import IamHarborClient, IamHarborClientOptions

    client = IamHarborClient(IamHarborClientOptions(
        base_url="https://users-api.run.app",
        audience="https://users-api.run.app",
    ))

    async with client as c:
        response = await c.get("/api/v1/users")

Quick start (environment-aware client — recommended)::

    from harbor_py.server import ServerHarborClient, ServerHarborClientOptions

    client = ServerHarborClient(ServerHarborClientOptions(base_url=config.users_api_url))

    async with client as c:
        response = await c.get("/api/v1/users")

Quick start (HarborManager — multiple clients)::

    from harbor_py import HarborManager, HarborClientOptions

    manager = HarborManager()
    manager.register_client("users", HarborClientOptions(base_url="http://users-api:8005"))
    manager.register_client("search", HarborClientOptions(base_url="http://search:8002"))

    users_client = manager.get_client("users")

Quick start (service clients with injection)::

    from harbor_py.server import ServerHarborClient, ServerHarborClientOptions
    from harbor_py.services.server import UsersServiceClient

    harbor = ServerHarborClient(ServerHarborClientOptions(base_url=config.users_api_url))
    users = UsersServiceClient(harbor)

    response = await users.get("/api/v1/users")
"""

# ─── Client exports ────────────────────────────────────────────────────────────
from harbor_py.client import (
    IHarborClient,
    HarborClient,
    HarborClientOptions,
    HarborManager,
    is_harbor_error,
)

# ─── Services exports ─────────────────────────────────────────────────────────
from harbor_py.services import (
    ServiceClient,
    GatewayServiceClient,
    UsersServiceClient,
    DocumentReaderServiceClient,
)

__all__ = [
    # client exports
    "IHarborClient",
    "HarborClient",
    "HarborClientOptions",
    "HarborManager",
    "is_harbor_error",
    # service exports
    "ServiceClient",
    "GatewayServiceClient",
    "UsersServiceClient",
    "DocumentReaderServiceClient",
]
