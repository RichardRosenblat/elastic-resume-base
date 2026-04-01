"""Unit tests for harbor_py server subpackage — IamHarborClient."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import httpx
import respx

from harbor_py.server import (
    create_iam_harbor_client,
    IamHarborClient,
    IamHarborClientOptions,
)


def test_iam_client_options_requires_audience() -> None:
    with pytest.raises(ValueError, match="audience"):
        IamHarborClientOptions(base_url="http://service", audience="")


def test_iam_client_options_stores_audience() -> None:
    opts = IamHarborClientOptions(base_url="http://service", audience="https://service.run.app")
    assert opts.audience == "https://service.run.app"


def test_create_iam_harbor_client_returns_iam_harbor_client() -> None:
    client = create_iam_harbor_client(
        base_url="http://service:8000",
        audience="https://service.run.app",
    )
    assert isinstance(client, IamHarborClient)


def test_create_iam_harbor_client_sets_base_url() -> None:
    client = create_iam_harbor_client(
        base_url="http://users-api:8005",
        audience="https://users-api.run.app",
    )
    assert str(client._client.base_url) == "http://users-api:8005"


def test_create_iam_harbor_client_sets_audience() -> None:
    client = create_iam_harbor_client(
        base_url="http://service",
        audience="https://my-service.run.app",
    )
    assert client._options.audience == "https://my-service.run.app"


@pytest.mark.asyncio
async def test_iam_harbor_client_context_manager() -> None:
    client = create_iam_harbor_client(
        base_url="http://localhost",
        audience="https://service.run.app",
    )
    async with client as c:
        assert c is client


@pytest.mark.asyncio
async def test_iam_harbor_client_attaches_bearer_token() -> None:
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
