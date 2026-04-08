"""GatewayServiceClient — client-side service client for the Gateway API (v3).

Use this class in browser/frontend code to communicate with the Gateway API.
Pass an :class:`~harbor_py.IHarborClient` at construction time so the transport
can be swapped or mocked in tests.
"""

from __future__ import annotations

from typing import Any

import httpx

from harbor_py.client.harbor_client import IHarborClient
from harbor_py.services.service_client import ServiceClient


class GatewayServiceClient(ServiceClient):
    """Client-side service client for the Gateway API.

    Delegates all HTTP calls to the injected :class:`~harbor_py.IHarborClient`.
    Extend this class to add typed Gateway API methods.

    Example::

        from harbor_py.services.client import GatewayServiceClient
        from harbor_py import HarborClient, HarborClientOptions

        harbor = HarborClient(HarborClientOptions(base_url="https://gateway.example.com"))
        gateway = GatewayServiceClient(harbor)

        response = await gateway.get("/api/v1/resumes")
    """

    def __init__(self, client: IHarborClient) -> None:
        super().__init__(client)

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a GET request."""
        return await self.client.get(url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a POST request."""
        return await self.client.post(url, **kwargs)

    async def put(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a PUT request."""
        return await self.client.put(url, **kwargs)

    async def patch(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a PATCH request."""
        return await self.client.patch(url, **kwargs)

    async def delete(self, url: str, **kwargs: Any) -> httpx.Response:
        """Send a DELETE request."""
        return await self.client.delete(url, **kwargs)

    async def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """Send an arbitrary HTTP request."""
        return await self.client.request(method, url, **kwargs)
