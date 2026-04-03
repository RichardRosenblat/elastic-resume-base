"""DocumentReaderServiceClient — server-side service client for the Document Reader API (v3).

Use this class in server services (e.g. the Gateway API) to communicate with the
Document Reader API.  Pass an :class:`~harbor_py.IHarborClient` at construction
time — typically a :class:`~harbor_py.server.ServerHarborClient` in production
or a mock in tests.
"""

from __future__ import annotations

from typing import Any

import httpx

from harbor_py.client.harbor_client import IHarborClient
from harbor_py.services.service_client import ServiceClient


class DocumentReaderServiceClient(ServiceClient):
    """Server-side service client for the Document Reader API.

    Delegates all HTTP calls to the injected :class:`~harbor_py.IHarborClient`.
    Extend this class to add typed Document Reader API methods.

    Example::

        from harbor_py.services.server import DocumentReaderServiceClient
        from harbor_py.server import ServerHarborClient, ServerHarborClientOptions

        harbor = ServerHarborClient(ServerHarborClientOptions(base_url=config.doc_reader_url))
        doc_reader = DocumentReaderServiceClient(harbor)

        response = await doc_reader.post("/read", json={"fileReference": "gs://bucket/file.pdf"})
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
