"""Unit tests for ServerHarborClient (v3) — environment-aware factory."""

from __future__ import annotations

import os

import pytest

from harbor_py.client import HarborClient
from harbor_py.server import IamHarborClient, ServerHarborClient, ServerHarborClientOptions


# ─── Development mode ─────────────────────────────────────────────────────────


def test_server_client_is_harbor_client(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = ServerHarborClient(ServerHarborClientOptions(base_url="http://service"))
    assert isinstance(client, HarborClient)


def test_server_client_dev_returns_plain_harbor_client(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = ServerHarborClient(ServerHarborClientOptions(base_url="http://service"))
    # In dev mode, the httpx client should NOT have the IAM event hook
    request_hooks = client._client.event_hooks.get("request", [])
    assert len(request_hooks) == 0


def test_server_client_returns_plain_when_env_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("NODE_ENV", raising=False)
    client = ServerHarborClient(ServerHarborClientOptions(base_url="http://service"))
    assert isinstance(client, HarborClient)
    request_hooks = client._client.event_hooks.get("request", [])
    assert len(request_hooks) == 0


def test_server_client_dev_sets_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = ServerHarborClient(ServerHarborClientOptions(base_url="http://users-api:8005"))
    assert str(client._client.base_url) == "http://users-api:8005"


def test_server_client_dev_sets_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = ServerHarborClient(
        ServerHarborClientOptions(base_url="http://service", timeout_seconds=10.0)
    )
    assert client._client.timeout.read == 10.0


def test_server_client_dev_sets_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = ServerHarborClient(
        ServerHarborClientOptions(
            base_url="http://service",
            default_headers={"x-api-key": "secret"},
        )
    )
    assert client._client.headers.get("x-api-key") == "secret"


# ─── Production mode ──────────────────────────────────────────────────────────


def test_server_client_prod_uses_iam_hook(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = ServerHarborClient(ServerHarborClientOptions(base_url="https://service.run.app"))
    # In production, the IAM event hook should be registered
    request_hooks = client._client.event_hooks.get("request", [])
    assert len(request_hooks) > 0


def test_server_client_prod_sets_base_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = ServerHarborClient(
        ServerHarborClientOptions(base_url="https://users-api.run.app")
    )
    assert str(client._client.base_url) == "https://users-api.run.app"


def test_server_client_prod_defaults_audience_to_base_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = ServerHarborClient(ServerHarborClientOptions(base_url="https://service.run.app"))
    iam_opts = client._options
    assert getattr(iam_opts, "audience", None) == "https://service.run.app"


def test_server_client_prod_uses_explicit_audience(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = ServerHarborClient(
        ServerHarborClientOptions(
            base_url="http://internal:8000",
            audience="https://service.run.app",
        )
    )
    iam_opts = client._options
    assert getattr(iam_opts, "audience", None) == "https://service.run.app"


def test_server_client_prod_sets_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = ServerHarborClient(
        ServerHarborClientOptions(base_url="https://service.run.app", timeout_seconds=15.0)
    )
    assert client._client.timeout.read == 15.0


# ─── Context manager ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_server_client_dev_context_manager(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "development")
    client = ServerHarborClient(ServerHarborClientOptions(base_url="http://localhost"))
    async with client as c:
        assert c is client


@pytest.mark.asyncio
async def test_server_client_prod_context_manager(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(os.environ, "NODE_ENV", "production")
    client = ServerHarborClient(ServerHarborClientOptions(base_url="https://service.run.app"))
    async with client as c:
        assert c is client
