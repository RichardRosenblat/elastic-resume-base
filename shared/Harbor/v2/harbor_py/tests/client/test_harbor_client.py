"""Unit tests for harbor_py client subpackage — HarborClient and is_harbor_error."""

from __future__ import annotations

import pytest
import httpx
import respx

from harbor_py.client import (
    create_harbor_client,
    is_harbor_error,
    HarborClient,
    HarborClientOptions,
)


def test_create_harbor_client_returns_harbor_client() -> None:
    """create_harbor_client returns a HarborClient instance."""
    client = create_harbor_client(base_url="http://localhost:8000")
    assert isinstance(client, HarborClient)


def test_create_harbor_client_applies_base_url() -> None:
    client = create_harbor_client(base_url="http://service:8001")
    assert str(client._client.base_url) == "http://service:8001"


def test_create_harbor_client_applies_timeout() -> None:
    client = create_harbor_client(base_url="http://service", timeout_seconds=10.0)
    assert client._client.timeout.read == 10.0


def test_create_harbor_client_no_timeout() -> None:
    client = create_harbor_client(base_url="http://service", timeout_seconds=None)
    assert client._client.timeout == httpx.Timeout(None)


def test_create_harbor_client_default_headers() -> None:
    client = create_harbor_client(
        base_url="http://service",
        default_headers={"x-api-key": "abc", "x-service": "test"},
    )
    assert client._client.headers.get("x-api-key") == "abc"
    assert client._client.headers.get("x-service") == "test"


def test_harbor_client_options_defaults() -> None:
    opts = HarborClientOptions(base_url="http://x")
    assert opts.timeout_seconds == 30.0
    assert opts.default_headers == {}


@pytest.mark.asyncio
async def test_harbor_client_context_manager() -> None:
    client = create_harbor_client(base_url="http://localhost")
    async with client as c:
        assert c is client


@pytest.mark.asyncio
async def test_harbor_client_get() -> None:
    with respx.mock:
        respx.get("http://svc/health").mock(return_value=httpx.Response(200, json={"ok": True}))
        client = create_harbor_client(base_url="http://svc")
        async with client as c:
            resp = await c.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_is_harbor_error_true_for_timeout() -> None:
    err = httpx.TimeoutException("timed out")
    assert is_harbor_error(err) is True


def test_is_harbor_error_true_for_connect_error() -> None:
    err = httpx.ConnectError("connection refused")
    assert is_harbor_error(err) is True


def test_is_harbor_error_false_for_plain_exception() -> None:
    assert is_harbor_error(Exception("plain")) is False
