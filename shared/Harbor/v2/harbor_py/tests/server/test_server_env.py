"""Unit tests for create_server_harbor_client — environment-aware factory."""

from __future__ import annotations

import os

import pytest

from harbor_py.client import HarborClient
from harbor_py.server.env import create_server_harbor_client
from harbor_py.server.iam import IamHarborClient

# ── Development mode ──────────────────────────────────────────────────────────


def test_server_client_returns_harbor_client_in_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = create_server_harbor_client(base_url="http://service:8000")
    assert isinstance(client, HarborClient)


def test_server_client_returns_harbor_client_when_env_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("NODE_ENV", raising=False)
    client = create_server_harbor_client(base_url="http://service:8000")
    assert isinstance(client, HarborClient)


def test_server_client_dev_sets_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = create_server_harbor_client(base_url="http://users-api:8005")
    assert str(client._client.base_url) == "http://users-api:8005"


def test_server_client_dev_sets_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = create_server_harbor_client(base_url="http://service", timeout_seconds=10.0)
    assert client._client.timeout.read == 10.0


def test_server_client_dev_sets_default_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = create_server_harbor_client(
        base_url="http://service",
        default_headers={"x-api-key": "secret"},
    )
    assert client._client.headers.get("x-api-key") == "secret"


# ── Production mode ───────────────────────────────────────────────────────────


def test_server_client_returns_iam_harbor_client_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = create_server_harbor_client(base_url="https://service.run.app")
    assert isinstance(client, IamHarborClient)


def test_server_client_prod_sets_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = create_server_harbor_client(base_url="https://users-api.run.app")
    assert str(client._client.base_url) == "https://users-api.run.app"


def test_server_client_prod_defaults_audience_to_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = create_server_harbor_client(base_url="https://service.run.app")
    assert isinstance(client, IamHarborClient)
    assert client._options.audience == "https://service.run.app"


def test_server_client_prod_uses_explicit_audience(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = create_server_harbor_client(
        base_url="http://internal:8000",
        audience="https://service.run.app",
    )
    assert isinstance(client, IamHarborClient)
    assert client._options.audience == "https://service.run.app"


def test_server_client_prod_sets_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = create_server_harbor_client(
        base_url="https://service.run.app",
        timeout_seconds=15.0,
    )
    assert isinstance(client, IamHarborClient)
    assert client._client.timeout.read == 15.0


def test_server_client_prod_sets_default_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = create_server_harbor_client(
        base_url="https://service.run.app",
        default_headers={"x-custom": "header"},
    )
    assert isinstance(client, IamHarborClient)
    assert client._client.headers.get("x-custom") == "header"


# ── Context manager works in both environments ────────────────────────────────


@pytest.mark.asyncio
async def test_server_client_dev_context_manager(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = create_server_harbor_client(base_url="http://localhost")
    async with client as c:
        assert c is client


@pytest.mark.asyncio
async def test_server_client_prod_context_manager(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = create_server_harbor_client(base_url="https://service.run.app")
    async with client as c:
        assert c is client
