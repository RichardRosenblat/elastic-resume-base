"""Unit tests for HarborClient and IHarborClient (v3)."""

from __future__ import annotations

import pytest
import httpx
import respx

from harbor_py.client import (
    HarborClient,
    HarborClientOptions,
    IHarborClient,
    is_harbor_error,
)


# ─── HarborClient ─────────────────────────────────────────────────────────────


def test_harbor_client_is_instance_of_iharbor_client() -> None:
    """HarborClient implements IHarborClient."""
    client = HarborClient(HarborClientOptions(base_url="http://service"))
    assert isinstance(client, IHarborClient)


def test_harbor_client_options_defaults() -> None:
    opts = HarborClientOptions(base_url="http://service")
    assert opts.timeout_seconds == 30.0
    assert opts.default_headers == {}


def test_harbor_client_applies_base_url() -> None:
    client = HarborClient(HarborClientOptions(base_url="http://service:8001"))
    assert str(client._client.base_url) == "http://service:8001"


def test_harbor_client_applies_timeout() -> None:
    client = HarborClient(HarborClientOptions(base_url="http://service", timeout_seconds=10.0))
    assert client._client.timeout.read == 10.0


def test_harbor_client_no_timeout() -> None:
    client = HarborClient(HarborClientOptions(base_url="http://service", timeout_seconds=None))
    assert client._client.timeout == httpx.Timeout(None)


def test_harbor_client_default_headers() -> None:
    client = HarborClient(
        HarborClientOptions(
            base_url="http://service",
            default_headers={"x-api-key": "abc", "x-service": "test"},
        )
    )
    assert client._client.headers.get("x-api-key") == "abc"
    assert client._client.headers.get("x-service") == "test"


def test_harbor_client_exposes_options() -> None:
    opts = HarborClientOptions(base_url="http://service")
    client = HarborClient(opts)
    assert client.options is opts


def test_harbor_client_exposes_httpx_client() -> None:
    client = HarborClient(HarborClientOptions(base_url="http://service"))
    assert isinstance(client.httpx_client, httpx.AsyncClient)


@pytest.mark.asyncio
async def test_harbor_client_context_manager() -> None:
    client = HarborClient(HarborClientOptions(base_url="http://localhost"))
    async with client as c:
        assert c is client


@pytest.mark.asyncio
async def test_harbor_client_get() -> None:
    with respx.mock:
        respx.get("http://svc/health").mock(return_value=httpx.Response(200, json={"ok": True}))
        client = HarborClient(HarborClientOptions(base_url="http://svc"))
        async with client as c:
            resp = await c.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


@pytest.mark.asyncio
async def test_harbor_client_post() -> None:
    with respx.mock:
        respx.post("http://svc/items").mock(
            return_value=httpx.Response(201, json={"id": "1"})
        )
        client = HarborClient(HarborClientOptions(base_url="http://svc"))
        async with client as c:
            resp = await c.post("/items", json={"name": "test"})
    assert resp.status_code == 201


# ─── is_harbor_error ──────────────────────────────────────────────────────────


def test_is_harbor_error_true_for_timeout() -> None:
    err = httpx.TimeoutException("timed out")
    assert is_harbor_error(err) is True


def test_is_harbor_error_true_for_connect_error() -> None:
    err = httpx.ConnectError("connection refused")
    assert is_harbor_error(err) is True


def test_is_harbor_error_true_for_http_status_error() -> None:
    request = httpx.Request("GET", "http://service/api")
    response = httpx.Response(500)
    err = httpx.HTTPStatusError("500", request=request, response=response)
    assert is_harbor_error(err) is True


def test_is_harbor_error_false_for_plain_exception() -> None:
    assert is_harbor_error(Exception("plain")) is False


def test_is_harbor_error_false_for_value_error() -> None:
    assert is_harbor_error(ValueError("value")) is False
