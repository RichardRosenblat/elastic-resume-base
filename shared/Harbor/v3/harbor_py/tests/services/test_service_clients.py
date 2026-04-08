"""Unit tests for service clients (v3) — using mock IHarborClient injection."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from harbor_py.client.harbor_client import IHarborClient
from harbor_py.services.client import GatewayServiceClient
from harbor_py.services.server import UsersServiceClient, DocumentReaderServiceClient


# ─── Helpers ──────────────────────────────────────────────────────────────────


def make_mock_client() -> MagicMock:
    """Create a mock IHarborClient."""
    mock = MagicMock(spec=IHarborClient)
    mock.get = AsyncMock()
    mock.post = AsyncMock()
    mock.put = AsyncMock()
    mock.patch = AsyncMock()
    mock.delete = AsyncMock()
    mock.request = AsyncMock()
    return mock


def make_response(status_code: int = 200, json_data: Any = None) -> httpx.Response:
    return httpx.Response(status_code, json=json_data or {})


# ─── GatewayServiceClient ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_gateway_service_client_delegates_get() -> None:
    mock = make_mock_client()
    mock.get.return_value = make_response(200, {"items": []})

    svc = GatewayServiceClient(mock)
    resp = await svc.get("/api/v1/resumes")

    mock.get.assert_called_once_with("/api/v1/resumes")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_gateway_service_client_delegates_post() -> None:
    mock = make_mock_client()
    mock.post.return_value = make_response(201, {"id": "abc"})

    svc = GatewayServiceClient(mock)
    resp = await svc.post("/api/v1/resumes", json={"title": "Test"})

    mock.post.assert_called_once_with("/api/v1/resumes", json={"title": "Test"})
    assert resp.json() == {"id": "abc"}


@pytest.mark.asyncio
async def test_gateway_service_client_delegates_put_patch_delete_request() -> None:
    mock = make_mock_client()
    mock.put.return_value = make_response(200)
    mock.patch.return_value = make_response(200)
    mock.delete.return_value = make_response(204)
    mock.request.return_value = make_response(200)

    svc = GatewayServiceClient(mock)
    await svc.put("/url", json={})
    await svc.patch("/url", json={})
    await svc.delete("/url")
    await svc.request("GET", "/url")

    mock.put.assert_called_once()
    mock.patch.assert_called_once()
    mock.delete.assert_called_once()
    mock.request.assert_called_once()


# ─── UsersServiceClient ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_users_service_client_delegates_get() -> None:
    mock = make_mock_client()
    mock.get.return_value = make_response(200, [{"id": "u1"}])

    svc = UsersServiceClient(mock)
    resp = await svc.get("/api/v1/users")

    mock.get.assert_called_once_with("/api/v1/users")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_users_service_client_delegates_post() -> None:
    mock = make_mock_client()
    mock.post.return_value = make_response(201, {"created": True})

    svc = UsersServiceClient(mock)
    await svc.post("/api/v1/users", json={"email": "a@b.com"})

    mock.post.assert_called_once_with("/api/v1/users", json={"email": "a@b.com"})


# ─── DocumentReaderServiceClient ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_document_reader_delegates_post() -> None:
    mock = make_mock_client()
    mock.post.return_value = make_response(200, {"text": "extracted"})

    svc = DocumentReaderServiceClient(mock)
    resp = await svc.post("/read", json={"fileReference": "gs://bucket/file.pdf"})

    mock.post.assert_called_once_with("/read", json={"fileReference": "gs://bucket/file.pdf"})
    assert resp.json() == {"text": "extracted"}


@pytest.mark.asyncio
async def test_document_reader_delegates_get() -> None:
    mock = make_mock_client()
    mock.get.return_value = make_response(200, {"status": "ok"})

    svc = DocumentReaderServiceClient(mock)
    await svc.get("/health")

    mock.get.assert_called_once_with("/health")
