"""Unit tests for the DLQ Notifier notification store, models, and REST API."""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from app.models.notification import NotificationListResponse, NotificationRecord
from app.models.pubsub import DlqMessagePayload
from app.services.notification_store import NotificationStore

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _encode(payload: dict[str, Any]) -> str:
    return base64.b64encode(json.dumps(payload).encode()).decode()


def _make_push_body(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = payload or {"resumeId": "abc-123", "error": "Processing failed", "service": "ingestor"}
    return {
        "message": {
            "data": _encode(data),
            "messageId": "msg-001",
            "publishTime": "2024-01-01T00:00:00Z",
        },
        "subscription": "projects/test/subscriptions/dlq-notifier-sub",
    }


def _make_firestore_doc(doc_id: str, data: dict[str, Any]) -> MagicMock:
    """Return a mock Firestore document snapshot."""
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = True
    doc.to_dict.return_value = data
    return doc


# ---------------------------------------------------------------------------
# DlqMessagePayload — new fields
# ---------------------------------------------------------------------------


def test_dlq_payload_parses_user_id() -> None:
    """DlqMessagePayload should parse userId field."""
    p = DlqMessagePayload.model_validate({"userId": "uid-001", "error": "fail"})
    assert p.user_id == "uid-001"


def test_dlq_payload_parses_category() -> None:
    """DlqMessagePayload should parse explicit category."""
    p = DlqMessagePayload.model_validate({"category": "system"})
    assert p.category == "system"


def test_dlq_payload_effective_category_user_when_user_id_present() -> None:
    """effective_category returns 'user' when userId is present."""
    p = DlqMessagePayload.model_validate({"userId": "uid-001"})
    assert p.effective_category == "user"


def test_dlq_payload_effective_category_system_when_no_user_id() -> None:
    """effective_category returns 'system' when userId is absent."""
    p = DlqMessagePayload.model_validate({})
    assert p.effective_category == "system"


def test_dlq_payload_effective_category_respects_explicit_category() -> None:
    """Explicit category overrides inferred category."""
    p = DlqMessagePayload.model_validate({"userId": "uid-001", "category": "system"})
    assert p.effective_category == "system"


def test_dlq_payload_effective_user_message_falls_back_to_error() -> None:
    """effective_user_message falls back to error when userMessage is absent."""
    p = DlqMessagePayload.model_validate({"error": "Something broke"})
    assert p.effective_user_message == "Something broke"


def test_dlq_payload_effective_user_message_prefers_user_message() -> None:
    """effective_user_message returns userMessage when both are set."""
    p = DlqMessagePayload.model_validate({"error": "Technical error", "userMessage": "User friendly"})
    assert p.effective_user_message == "User friendly"


# ---------------------------------------------------------------------------
# NotificationRecord model
# ---------------------------------------------------------------------------


def test_notification_record_defaults() -> None:
    """NotificationRecord should have sensible defaults."""
    record = NotificationRecord()
    assert record.id == ""
    assert record.category == "system"
    assert record.user_id is None
    assert record.read is False


def test_notification_list_response() -> None:
    """NotificationListResponse wraps a list and total count."""
    resp = NotificationListResponse(
        notifications=[NotificationRecord(id="n1", category="user")],
        total=1,
    )
    assert resp.total == 1
    assert resp.notifications[0].id == "n1"


# ---------------------------------------------------------------------------
# NotificationStore
# ---------------------------------------------------------------------------


def _make_store() -> NotificationStore:
    return NotificationStore(collection_name="notifications", ttl_days=30)


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_save_returns_document_id(mock_col: MagicMock) -> None:
    """save() should return the generated Firestore document ID."""
    mock_doc_ref = MagicMock()
    mock_doc_ref.id = "generated-doc-id"
    mock_col.return_value.document.return_value = mock_doc_ref

    store = _make_store()
    doc_id = store.save({"category": "system", "error": "test"})
    assert doc_id == "generated-doc-id"
    mock_doc_ref.set.assert_called_once()


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_save_returns_empty_on_firestore_error(mock_col: MagicMock) -> None:
    """save() should return '' when Firestore raises."""
    mock_col.side_effect = Exception("Firestore unavailable")

    store = _make_store()
    result = store.save({"category": "system"})
    assert result == ""


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_mark_read_returns_true_on_success(mock_col: MagicMock) -> None:
    """mark_read() should return True after a successful update."""
    doc = _make_firestore_doc("n1", {"userId": "uid-001", "category": "user"})
    mock_col.return_value.document.return_value.get.return_value = doc

    store = _make_store()
    result = store.mark_read("n1", user_id="uid-001")
    assert result is True


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_mark_read_returns_false_when_not_found(mock_col: MagicMock) -> None:
    """mark_read() returns False when the document does not exist."""
    doc = MagicMock()
    doc.exists = False
    mock_col.return_value.document.return_value.get.return_value = doc

    store = _make_store()
    result = store.mark_read("missing-id")
    assert result is False


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_mark_read_denies_wrong_user(mock_col: MagicMock) -> None:
    """mark_read() returns False when userId does not match."""
    doc = _make_firestore_doc("n1", {"userId": "uid-owner"})
    mock_col.return_value.document.return_value.get.return_value = doc

    store = _make_store()
    result = store.mark_read("n1", user_id="uid-other")
    assert result is False


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_delete_returns_true_on_success(mock_col: MagicMock) -> None:
    """delete() returns True after a successful deletion."""
    doc = _make_firestore_doc("n1", {"userId": "uid-001"})
    mock_col.return_value.document.return_value.get.return_value = doc

    store = _make_store()
    result = store.delete("n1", user_id="uid-001")
    assert result is True
    mock_col.return_value.document.return_value.delete.assert_called_once()


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_delete_denies_wrong_user(mock_col: MagicMock) -> None:
    """delete() returns False when userId does not match."""
    doc = _make_firestore_doc("n1", {"userId": "uid-owner"})
    mock_col.return_value.document.return_value.get.return_value = doc

    store = _make_store()
    result = store.delete("n1", user_id="uid-other")
    assert result is False


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_get_user_notifications_returns_records(mock_col: MagicMock) -> None:
    """get_user_notifications() should return a list of NotificationRecord objects."""
    doc = _make_firestore_doc("n1", {
        "category": "user",
        "userId": "uid-001",
        "error": "failed",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "read": False,
    })
    mock_col.return_value.where.return_value.where.return_value.where.return_value\
        .order_by.return_value.limit.return_value.stream.return_value = [doc]

    store = _make_store()
    records = store.get_user_notifications("uid-001")
    assert len(records) == 1
    assert records[0].id == "n1"
    assert records[0].category == "user"


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_get_user_notifications_returns_empty_on_error(mock_col: MagicMock) -> None:
    """get_user_notifications() returns [] when Firestore raises."""
    mock_col.side_effect = Exception("Firestore error")
    store = _make_store()
    result = store.get_user_notifications("uid-001")
    assert result == []


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_get_system_notifications_returns_records(mock_col: MagicMock) -> None:
    """get_system_notifications() should return system notification records."""
    doc = _make_firestore_doc("s1", {
        "category": "system",
        "service": "ai-worker",
        "error": "extraction error",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "read": False,
    })
    mock_col.return_value.where.return_value.order_by.return_value\
        .limit.return_value.stream.return_value = [doc]

    store = _make_store()
    records = store.get_system_notifications()
    assert len(records) == 1
    assert records[0].service == "ai-worker"


@patch("app.services.notification_store.NotificationStore._get_collection")
def test_store_delete_old_notifications_removes_docs(mock_col: MagicMock) -> None:
    """delete_old_notifications() should delete aged documents."""
    doc = MagicMock()
    mock_col.return_value.where.return_value.stream.return_value = [doc, doc]

    store = _make_store()
    count = store.delete_old_notifications()
    assert count == 2
    assert doc.reference.delete.call_count == 2


# ---------------------------------------------------------------------------
# Pubsub endpoint — notification store integration
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_push_endpoint_stores_notification(app_client: AsyncClient) -> None:
    """push endpoint should call notification store.save() with the notification record."""
    with patch("app.routers.pubsub._get_notification_service") as mock_factory, \
         patch("app.routers.pubsub._get_notification_store") as mock_store_factory:
        mock_svc = MagicMock()
        mock_svc.send_dlq_alert.return_value = None
        mock_factory.return_value = mock_svc

        mock_store = MagicMock()
        mock_store.save.return_value = "new-notification-id"
        mock_store_factory.return_value = mock_store

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body({"resumeId": "abc-123", "error": "Failed", "userId": "uid-001"}),
            )

    assert response.status_code == 200
    mock_store.save.assert_called_once()
    saved_data = mock_store.save.call_args[0][0]
    assert saved_data["userId"] == "uid-001"
    assert saved_data["category"] == "user"


@pytest.mark.asyncio
async def test_push_endpoint_system_category_without_user_id(app_client: AsyncClient) -> None:
    """push endpoint should categorise messages without userId as 'system'."""
    with patch("app.routers.pubsub._get_notification_service") as mock_factory, \
         patch("app.routers.pubsub._get_notification_store") as mock_store_factory:
        mock_svc = MagicMock()
        mock_svc.send_dlq_alert.return_value = None
        mock_factory.return_value = mock_svc

        mock_store = MagicMock()
        mock_store.save.return_value = "sys-id"
        mock_store_factory.return_value = mock_store

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body({"error": "System failure", "service": "ai-worker"}),
            )

    assert response.status_code == 200
    saved_data = mock_store.save.call_args[0][0]
    assert saved_data["category"] == "system"
    assert saved_data["userId"] is None


@pytest.mark.asyncio
async def test_push_endpoint_returns_200_when_store_fails(app_client: AsyncClient) -> None:
    """push endpoint returns 200 even if Firestore storage fails."""
    with patch("app.routers.pubsub._get_notification_service") as mock_factory, \
         patch("app.routers.pubsub._get_notification_store") as mock_store_factory:
        mock_svc = MagicMock()
        mock_svc.send_dlq_alert.return_value = None
        mock_factory.return_value = mock_svc

        mock_store = MagicMock()
        mock_store.save.return_value = ""  # simulates failure (empty ID returned)
        mock_store_factory.return_value = mock_store

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body(),
            )

    assert response.status_code == 200
    assert response.json()["success"] is True


# ---------------------------------------------------------------------------
# Notification REST API endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_notifications_requires_user_id_header(app_client: AsyncClient) -> None:
    """GET /api/v1/notifications without X-User-Id should return 401."""
    async with app_client as client:
        response = await client.get("/api/v1/notifications")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_notifications_returns_records(app_client: AsyncClient) -> None:
    """GET /api/v1/notifications with valid header should return notification list."""
    mock_records = [
        NotificationRecord(id="n1", category="user", user_id="uid-001", created_at="2024-01-01T00:00:00Z"),
    ]
    with patch("app.routers.notifications._get_store") as mock_store_factory:
        mock_store = MagicMock()
        mock_store.get_user_notifications.return_value = mock_records
        mock_store_factory.return_value = mock_store

        async with app_client as client:
            response = await client.get(
                "/api/v1/notifications",
                headers={"x-user-id": "uid-001", "x-user-role": "user"},
            )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["total"] == 1
    assert body["data"]["notifications"][0]["id"] == "n1"


@pytest.mark.asyncio
async def test_list_system_notifications_forbidden_for_non_admin(app_client: AsyncClient) -> None:
    """GET /api/v1/notifications/system should return 403 for non-admin users."""
    async with app_client as client:
        response = await client.get(
            "/api/v1/notifications/system",
            headers={"x-user-id": "uid-001", "x-user-role": "user"},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_system_notifications_returns_records_for_admin(app_client: AsyncClient) -> None:
    """GET /api/v1/notifications/system should return records for admin."""
    mock_records = [
        NotificationRecord(id="s1", category="system", service="ai-worker"),
    ]
    with patch("app.routers.notifications._get_store") as mock_store_factory:
        mock_store = MagicMock()
        mock_store.get_system_notifications.return_value = mock_records
        mock_store_factory.return_value = mock_store

        async with app_client as client:
            response = await client.get(
                "/api/v1/notifications/system",
                headers={"x-user-id": "uid-admin", "x-user-role": "admin"},
            )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["total"] == 1


@pytest.mark.asyncio
async def test_mark_read_returns_200_on_success(app_client: AsyncClient) -> None:
    """PATCH /api/v1/notifications/{id}/read should return 200 on success."""
    with patch("app.routers.notifications._get_store") as mock_store_factory:
        mock_store = MagicMock()
        mock_store.mark_read.return_value = True
        mock_store_factory.return_value = mock_store

        async with app_client as client:
            response = await client.patch(
                "/api/v1/notifications/n1/read",
                headers={"x-user-id": "uid-001", "x-user-role": "user"},
            )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["read"] is True


@pytest.mark.asyncio
async def test_mark_read_returns_404_when_not_found(app_client: AsyncClient) -> None:
    """PATCH /api/v1/notifications/{id}/read returns 404 when not found."""
    with patch("app.routers.notifications._get_store") as mock_store_factory:
        mock_store = MagicMock()
        mock_store.mark_read.return_value = False
        mock_store_factory.return_value = mock_store

        async with app_client as client:
            response = await client.patch(
                "/api/v1/notifications/missing/read",
                headers={"x-user-id": "uid-001", "x-user-role": "user"},
            )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_notification_returns_204_on_success(app_client: AsyncClient) -> None:
    """DELETE /api/v1/notifications/{id} should return 204 on success."""
    with patch("app.routers.notifications._get_store") as mock_store_factory:
        mock_store = MagicMock()
        mock_store.delete.return_value = True
        mock_store_factory.return_value = mock_store

        async with app_client as client:
            response = await client.delete(
                "/api/v1/notifications/n1",
                headers={"x-user-id": "uid-001", "x-user-role": "user"},
            )

    assert response.status_code == 200  # JSON response with deleted flag


@pytest.mark.asyncio
async def test_delete_notification_returns_404_when_not_found(app_client: AsyncClient) -> None:
    """DELETE /api/v1/notifications/{id} returns 404 when not found."""
    with patch("app.routers.notifications._get_store") as mock_store_factory:
        mock_store = MagicMock()
        mock_store.delete.return_value = False
        mock_store_factory.return_value = mock_store

        async with app_client as client:
            response = await client.delete(
                "/api/v1/notifications/missing",
                headers={"x-user-id": "uid-001", "x-user-role": "user"},
            )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_mark_read_requires_user_id_header(app_client: AsyncClient) -> None:
    """PATCH mark-read without X-User-Id should return 401."""
    async with app_client as client:
        response = await client.patch("/api/v1/notifications/n1/read")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_requires_user_id_header(app_client: AsyncClient) -> None:
    """DELETE without X-User-Id should return 401."""
    async with app_client as client:
        response = await client.delete("/api/v1/notifications/n1")
    assert response.status_code == 401
