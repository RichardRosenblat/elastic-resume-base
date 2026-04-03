"""ServiceClient — abstract base class for service-specific HTTP clients (v3).

Extend this class to create typed service clients that accept an
:class:`~harbor_py.IHarborClient` via constructor injection.  This makes the
service client independently testable: pass a mock
:class:`~harbor_py.IHarborClient` in tests and the real
:class:`~harbor_py.HarborClient` (or :class:`~harbor_py.server.IamHarborClient`)
in production.

Example::

    from harbor_py.services import ServiceClient
    from harbor_py import HarborClient, HarborClientOptions

    class UsersServiceClient(ServiceClient):
        async def list_users(self) -> list[dict]:
            response = await self.client.get("/api/v1/users")
            response.raise_for_status()
            return response.json()

    # In production:
    harbor = HarborClient(HarborClientOptions(base_url=config.users_api_url))
    users_client = UsersServiceClient(harbor)

    # In tests:
    from unittest.mock import AsyncMock
    mock_harbor = AsyncMock()
    users_client = UsersServiceClient(mock_harbor)
"""

from __future__ import annotations

from abc import ABC

from harbor_py.client.harbor_client import IHarborClient


class ServiceClient(ABC):
    """Abstract base class for service-specific HTTP clients.

    All concrete service client classes should extend this class and accept an
    :class:`~harbor_py.IHarborClient` via constructor injection.

    Attributes:
        client: The underlying Harbor HTTP client, available to subclasses.
    """

    def __init__(self, client: IHarborClient) -> None:
        self.client: IHarborClient = client
