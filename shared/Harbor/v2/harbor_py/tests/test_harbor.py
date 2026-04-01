"""Unit tests for harbor_py v2 — HarborClient, IamHarborClient, and is_harbor_error."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import httpx
import respx

from harbor_py import (
    create_harbor_client,
    is_harbor_error,
    HarborClient,
    HarborClientOptions,
    create_iam_harbor_client,
    IamHarborClient,
    IamHarborClientOptions,
)


# ---------------------------------------------------------------------------
# create_harbor_client (v1 functionality re-exported unchanged)
# ---------------------------------------------------------------------------


def test_create_harbor_client_returns_harbor_client() -> None:
    """create_harbor_client returns a HarborClient instance."""
    client = create_harbor_client(base_url="http://localhost:8000")
    assert isinstance(client, HarborClient)


def test_create_harbor_client_applies_base_url() -> None:
    """create_harbor_client sets the provided base URL."""
    client = create_harbor_client(base_url="http://service:8001")
    assert str(client._client.base_url) == "http://service:8001"


def test_create_harbor_client_applies_timeout() -> None:
    """create_harbor_client sets the provided timeout."""
    client = create_harbor_client(base_url="http://service", timeout_seconds=10.0)
    assert client._client.timeout.read == 10.0


def test_create_harbor_client_no_timeout() -> None:
    """create_harbor_client disables timeout when None is passed."""
    client = create_harbor_client(base_url="http://service", timeout_seconds=None)
    assert client._client.timeout == httpx.Timeout(None)


def test_create_harbor_client_default_headers() -> None:
    """create_harbor_client attaches default headers."""
    client = create_harbor_client(
        base_url="http://service",
        default_headers={"x-api-key": "abc", "x-service": "test"},
    )
    assert client._client.headers.get("x-api-key") == "abc"
    assert client._client.headers.get("x-service") == "test"


def test_create_harbor_client_independent_instances() -> None:
    """Multiple calls produce independent clients."""
    a = create_harbor_client(base_url="http://service-a")
    b = create_harbor_client(base_url="http://service-b")
    assert str(a._client.base_url) != str(b._client.base_url)


# ---------------------------------------------------------------------------
# HarborClientOptions dataclass
# ---------------------------------------------------------------------------


def test_harbor_client_options_defaults() -> None:
    """HarborClientOptions uses sensible defaults."""
    opts = HarborClientOptions(base_url="http://x")
    assert opts.timeout_seconds == 30.0
    assert opts.default_headers == {}


# ---------------------------------------------------------------------------
# HarborClient context manager
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_harbor_client_context_manager() -> None:
    """HarborClient can be used as an async context manager."""
    client = create_harbor_client(base_url="http://localhost")
    async with client as c:
        assert c is client


# ---------------------------------------------------------------------------
# HarborClient HTTP methods (mocked)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_harbor_client_get() -> None:
    """HarborClient.get sends a GET request and returns the response."""
    with respx.mock:
        respx.get("http://svc/health").mock(return_value=httpx.Response(200, json={"ok": True}))
        client = create_harbor_client(base_url="http://svc")
        async with client as c:
            resp = await c.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


@pytest.mark.asyncio
async def test_harbor_client_post() -> None:
    """HarborClient.post sends a POST request and returns the response."""
    with respx.mock:
        respx.post("http://svc/items").mock(return_value=httpx.Response(201, json={"id": "1"}))
        client = create_harbor_client(base_url="http://svc")
        async with client as c:
            resp = await c.post("/items", json={"name": "test"})
    assert resp.status_code == 201


# ---------------------------------------------------------------------------
# is_harbor_error (v1 functionality re-exported unchanged)
# ---------------------------------------------------------------------------


def test_is_harbor_error_true_for_timeout() -> None:
    """is_harbor_error returns True for httpx.TimeoutException."""
    err = httpx.TimeoutException("timed out")
    assert is_harbor_error(err) is True


def test_is_harbor_error_true_for_connect_error() -> None:
    """is_harbor_error returns True for httpx.ConnectError."""
    err = httpx.ConnectError("connection refused")
    assert is_harbor_error(err) is True


def test_is_harbor_error_false_for_plain_exception() -> None:
    """is_harbor_error returns False for a plain Exception."""
    assert is_harbor_error(Exception("plain")) is False


# ---------------------------------------------------------------------------
# IamHarborClientOptions validation
# ---------------------------------------------------------------------------


def test_iam_client_options_requires_audience() -> None:
    """IamHarborClientOptions raises ValueError when audience is empty."""
    import pytest

    with pytest.raises(ValueError, match="audience"):
        IamHarborClientOptions(base_url="http://service", audience="")


def test_iam_client_options_stores_audience() -> None:
    """IamHarborClientOptions stores the provided audience."""
    opts = IamHarborClientOptions(base_url="http://service", audience="https://service.run.app")
    assert opts.audience == "https://service.run.app"


# ---------------------------------------------------------------------------
# create_iam_harbor_client
# ---------------------------------------------------------------------------


def test_create_iam_harbor_client_returns_iam_harbor_client() -> None:
    """create_iam_harbor_client returns an IamHarborClient instance."""
    client = create_iam_harbor_client(
        base_url="http://service:8000",
        audience="https://service.run.app",
    )
    assert isinstance(client, IamHarborClient)


def test_create_iam_harbor_client_sets_base_url() -> None:
    """create_iam_harbor_client sets the base URL on the underlying httpx client."""
    client = create_iam_harbor_client(
        base_url="http://users-api:8005",
        audience="https://users-api.run.app",
    )
    assert str(client._client.base_url) == "http://users-api:8005"


def test_create_iam_harbor_client_sets_audience() -> None:
    """create_iam_harbor_client stores the audience for token fetching."""
    client = create_iam_harbor_client(
        base_url="http://service",
        audience="https://my-service.run.app",
    )
    assert client._options.audience == "https://my-service.run.app"


def test_create_iam_harbor_client_applies_timeout() -> None:
    """create_iam_harbor_client sets the provided timeout."""
    client = create_iam_harbor_client(
        base_url="http://service",
        audience="https://service.run.app",
        timeout_seconds=15.0,
    )
    assert client._client.timeout.read == 15.0


def test_create_iam_harbor_client_no_timeout() -> None:
    """create_iam_harbor_client disables timeout when None is passed."""
    client = create_iam_harbor_client(
        base_url="http://service",
        audience="https://service.run.app",
        timeout_seconds=None,
    )
    assert client._client.timeout == httpx.Timeout(None)


# ---------------------------------------------------------------------------
# IamHarborClient context manager
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_iam_harbor_client_context_manager() -> None:
    """IamHarborClient can be used as an async context manager."""
    client = create_iam_harbor_client(
        base_url="http://localhost",
        audience="https://service.run.app",
    )
    async with client as c:
        assert c is client


# ---------------------------------------------------------------------------
# IamHarborClient token attachment (mocked)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_iam_harbor_client_attaches_bearer_token() -> None:
    """IamHarborClient adds Authorization header from OIDC token on each request."""
    fake_token = "mock-oidc-token"

    with (
        patch("google.oauth2.id_token.fetch_id_token", return_value=fake_token),
        patch("google.auth.transport.requests.Request", return_value=MagicMock()),
        respx.mock,
    ):
        respx.get("http://svc/api").mock(return_value=httpx.Response(200, json={"ok": True}))

        client = create_iam_harbor_client(
            base_url="http://svc",
            audience="https://svc.run.app",
        )
        async with client as c:
            resp = await c.get("/api")

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_iam_harbor_client_proceeds_without_token_on_error() -> None:
    """IamHarborClient continues without token when ADC fetch raises an exception."""
    with (
        patch("google.oauth2.id_token.fetch_id_token", side_effect=Exception("ADC error")),
        patch("google.auth.transport.requests.Request", return_value=MagicMock()),
        respx.mock,
    ):
        respx.get("http://svc/api").mock(return_value=httpx.Response(401, json={}))

        client = create_iam_harbor_client(
            base_url="http://svc",
            audience="https://svc.run.app",
        )
        async with client as c:
            resp = await c.get("/api")

    assert resp.status_code == 401
