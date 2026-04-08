"""Unit tests for the DLQ Notifier Pub/Sub push endpoint, models, and services."""

from __future__ import annotations

import base64
import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from app.models.pubsub import DlqMessagePayload, PubSubMessage
from app.services.notification_service import NotificationService
from app.utils.exceptions import PubSubMessageError

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _encode(payload: dict[str, Any]) -> str:
    return base64.b64encode(json.dumps(payload).encode()).decode()


def _make_push_body(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = payload or {"resumeId": "abc-123", "error": "Processing failed", "service": "ingestor"}
    encoded = _encode(data)
    return {
        "message": {
            "data": encoded,
            "messageId": "msg-001",
            "publishTime": "2024-01-01T00:00:00Z",
        },
        "subscription": "projects/test/subscriptions/dlq-notifier-sub",
    }


# ---------------------------------------------------------------------------
# PubSubMessage.decode_data
# ---------------------------------------------------------------------------


def test_decode_data_returns_parsed_dict() -> None:
    """decode_data should return the JSON-parsed payload dict."""
    msg = PubSubMessage(data=_encode({"resumeId": "abc-123"}))
    result = msg.decode_data()
    assert result == {"resumeId": "abc-123"}


def test_decode_data_raises_on_invalid_base64() -> None:
    """decode_data raises PubSubMessageError on invalid base64."""
    msg = PubSubMessage(data="NOT_VALID_BASE64!!!")
    with pytest.raises(PubSubMessageError, match="base64-decode"):
        msg.decode_data()


def test_decode_data_raises_on_non_json_payload() -> None:
    """decode_data raises PubSubMessageError when payload is not JSON."""
    raw = base64.b64encode(b"plain text, not json").decode()
    msg = PubSubMessage(data=raw)
    with pytest.raises(PubSubMessageError, match="JSON-parse"):
        msg.decode_data()


# ---------------------------------------------------------------------------
# DlqMessagePayload
# ---------------------------------------------------------------------------


def test_dlq_payload_parses_all_fields() -> None:
    """DlqMessagePayload should parse a fully-populated DLQ message."""
    p = DlqMessagePayload.model_validate(
        {
            "resumeId": "abc-123",
            "error": "Something broke",
            "service": "ingestor",
            "stage": "download",
            "errorType": "DOWNLOAD_ERROR",
        }
    )
    assert p.resume_id == "abc-123"
    assert p.error == "Something broke"
    assert p.service == "ingestor"
    assert p.stage == "download"
    assert p.error_type == "DOWNLOAD_ERROR"


def test_dlq_payload_all_fields_optional() -> None:
    """DlqMessagePayload should parse an empty dict (all fields are optional)."""
    p = DlqMessagePayload.model_validate({})
    assert p.resume_id is None
    assert p.error is None
    assert p.service is None
    assert p.stage is None
    assert p.error_type is None


def test_dlq_payload_allows_extra_fields() -> None:
    """DlqMessagePayload should not raise on unknown extra fields."""
    p = DlqMessagePayload.model_validate({"resumeId": "abc-123", "unknownField": "value"})
    assert p.resume_id == "abc-123"


# ---------------------------------------------------------------------------
# NotificationService
# ---------------------------------------------------------------------------


def test_notification_service_sends_message() -> None:
    """send_dlq_alert should call messaging_service.send with correct params."""
    mock_messaging = MagicMock()
    svc = NotificationService(mock_messaging, ["ops@example.com"])

    svc.send_dlq_alert(
        resume_id="abc-123",
        service="ingestor",
        stage="download",
        error_type="DOWNLOAD_ERROR",
        error="Connection timeout",
        message_id="msg-001",
        publish_time="2024-01-01T00:00:00Z",
        subscription="projects/p/subscriptions/dlq-sub",
    )

    mock_messaging.send.assert_called_once()
    call_args = mock_messaging.send.call_args[0][0]
    assert "ops@example.com" in call_args.to
    assert "DLQ Alert" in call_args.subject
    assert "abc-123" in call_args.body
    assert "ingestor" in call_args.body
    assert "Connection timeout" in call_args.body


def test_notification_service_sends_to_multiple_recipients() -> None:
    """send_dlq_alert should include all configured recipients."""
    mock_messaging = MagicMock()
    svc = NotificationService(mock_messaging, ["alice@example.com", "bob@example.com"])

    svc.send_dlq_alert(
        resume_id=None,
        service=None,
        stage=None,
        error_type=None,
        error=None,
        message_id="msg-002",
        publish_time="",
        subscription="",
    )

    call_args = mock_messaging.send.call_args[0][0]
    assert "alice@example.com" in call_args.to
    assert "bob@example.com" in call_args.to


def test_notification_service_logs_warning_on_send_failure() -> None:
    """send_dlq_alert should log a warning and not raise when send fails."""
    mock_messaging = MagicMock()
    mock_messaging.send.side_effect = Exception("SMTP server down")
    svc = NotificationService(mock_messaging, ["ops@example.com"])

    # Must not raise
    svc.send_dlq_alert(
        resume_id="abc-123",
        service="ingestor",
        stage=None,
        error_type=None,
        error="test error",
        message_id="msg-001",
        publish_time="",
        subscription="",
    )


def test_notification_service_handles_unknown_fields() -> None:
    """send_dlq_alert formats unknown/None fields as '(unknown)'."""
    mock_messaging = MagicMock()
    svc = NotificationService(mock_messaging, ["ops@example.com"])

    svc.send_dlq_alert(
        resume_id=None,
        service=None,
        stage=None,
        error_type=None,
        error=None,
        message_id="",
        publish_time="",
        subscription="",
    )

    call_args = mock_messaging.send.call_args[0][0]
    assert "(unknown)" in call_args.body


# ---------------------------------------------------------------------------
# POST /api/v1/pubsub/push
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_push_endpoint_returns_200_on_success(app_client: AsyncClient) -> None:
    """Successfully processed DLQ message should return HTTP 200."""
    with patch("app.routers.pubsub._get_notification_service") as mock_factory:
        mock_svc = MagicMock()
        mock_svc.send_dlq_alert.return_value = None
        mock_factory.return_value = mock_svc

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body(),
            )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "acknowledged"


@pytest.mark.asyncio
async def test_push_endpoint_returns_400_on_malformed_envelope(app_client: AsyncClient) -> None:
    """A malformed push envelope should return HTTP 400."""
    async with app_client as client:
        response = await client.post(
            "/api/v1/pubsub/push",
            json={"not_a_message": "bad"},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_push_endpoint_returns_400_on_bad_base64(app_client: AsyncClient) -> None:
    """Invalid base64 data should return HTTP 400."""
    body = {
        "message": {
            "data": "NOT_VALID_BASE64!!!",
            "messageId": "m1",
        },
        "subscription": "projects/p/subscriptions/s",
    }
    async with app_client as client:
        response = await client.post("/api/v1/pubsub/push", json=body)

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_push_endpoint_returns_200_even_when_notification_fails(
    app_client: AsyncClient,
) -> None:
    """Notification failure should still return HTTP 200 (acknowledge the message)."""
    with patch("app.routers.pubsub._get_notification_service") as mock_factory:
        mock_svc = MagicMock()
        mock_svc.send_dlq_alert.side_effect = Exception("SMTP down")
        mock_factory.return_value = mock_svc

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body(),
            )

    # Must still return 200 — notification errors must not trigger Pub/Sub retries
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_push_endpoint_handles_partial_payload(app_client: AsyncClient) -> None:
    """DLQ message with only partial fields should return HTTP 200."""
    partial_payload = {"error": "Something broke"}  # no resumeId, service, etc.

    with patch("app.routers.pubsub._get_notification_service") as mock_factory:
        mock_svc = MagicMock()
        mock_svc.send_dlq_alert.return_value = None
        mock_factory.return_value = mock_svc

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body(partial_payload),
            )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_push_endpoint_includes_resume_id_in_response(app_client: AsyncClient) -> None:
    """Response data should include the resumeId from the DLQ payload."""
    payload = {"resumeId": "xyz-789", "error": "Processing failed"}

    with patch("app.routers.pubsub._get_notification_service") as mock_factory:
        mock_svc = MagicMock()
        mock_svc.send_dlq_alert.return_value = None
        mock_factory.return_value = mock_svc

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body(payload),
            )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["resumeId"] == "xyz-789"


# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_liveness_returns_200(app_client: AsyncClient) -> None:
    """GET /health/live should return 200."""
    async with app_client as client:
        response = await client.get("/health/live")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_readiness_returns_200(app_client: AsyncClient) -> None:
    """GET /health/ready should return 200."""
    async with app_client as client:
        response = await client.get("/health/ready")
    assert response.status_code == 200
