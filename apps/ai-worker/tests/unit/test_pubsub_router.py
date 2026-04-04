"""Unit tests for the Pub/Sub push endpoint and models."""

from __future__ import annotations

import base64
import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from app.models.pubsub import PubSubMessage, PubSubPushEnvelope, ResumeIngestedPayload
from app.utils.exceptions import PubSubMessageError


# ---------------------------------------------------------------------------
# PubSubMessage.decode_data
# ---------------------------------------------------------------------------


def _encode(payload: dict[str, Any]) -> str:
    return base64.b64encode(json.dumps(payload).encode()).decode()


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
# ResumeIngestedPayload
# ---------------------------------------------------------------------------


def test_resume_ingested_payload_valid() -> None:
    """ResumeIngestedPayload should parse a valid resumeId."""
    p = ResumeIngestedPayload.model_validate({"resumeId": "abc-123"})
    assert p.resume_id == "abc-123"


def test_resume_ingested_payload_strips_whitespace() -> None:
    """ResumeIngestedPayload validator strips surrounding whitespace."""
    p = ResumeIngestedPayload.model_validate({"resumeId": "  abc-123  "})
    assert p.resume_id == "abc-123"


def test_resume_ingested_payload_empty_raises() -> None:
    """ResumeIngestedPayload raises when resumeId is empty."""
    with pytest.raises(Exception):
        ResumeIngestedPayload.model_validate({"resumeId": "   "})


def test_resume_ingested_payload_missing_raises() -> None:
    """ResumeIngestedPayload raises when resumeId field is absent."""
    with pytest.raises(Exception):
        ResumeIngestedPayload.model_validate({})


# ---------------------------------------------------------------------------
# POST /api/v1/pubsub/push
# ---------------------------------------------------------------------------


def _make_push_body(resume_id: str = "abc-123") -> dict[str, Any]:
    payload = json.dumps({"resumeId": resume_id}).encode()
    encoded = base64.b64encode(payload).decode()
    return {
        "message": {
            "data": encoded,
            "messageId": "msg-001",
            "publishTime": "2024-01-01T00:00:00Z",
        },
        "subscription": "projects/test/subscriptions/resume-ingested-sub",
    }


@pytest.mark.asyncio
async def test_push_endpoint_returns_200_on_success(app_client: AsyncClient) -> None:
    """Successful processing should return HTTP 200."""
    with patch("app.routers.pubsub._get_ai_worker_service") as mock_factory:
        mock_svc = MagicMock()
        mock_svc.process_resume.return_value = None
        mock_factory.return_value = mock_svc

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body("abc-123"),
            )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["resumeId"] == "abc-123"


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
async def test_push_endpoint_returns_200_on_not_found(app_client: AsyncClient) -> None:
    """SynapseNotFoundError is a permanent error — should ack (200) and not retry."""
    from synapse_py import SynapseNotFoundError

    with patch("app.routers.pubsub._get_ai_worker_service") as mock_factory:
        mock_svc = MagicMock()
        mock_svc.process_resume.side_effect = SynapseNotFoundError("abc-123")
        mock_factory.return_value = mock_svc

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body("abc-123"),
            )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_push_endpoint_returns_500_on_vertex_ai_error(app_client: AsyncClient) -> None:
    """Vertex AI errors are transient — should return 500 to trigger Pub/Sub retry."""
    from app.utils.exceptions import ExtractionError

    with patch("app.routers.pubsub._get_ai_worker_service") as mock_factory:
        mock_svc = MagicMock()
        mock_svc.process_resume.side_effect = ExtractionError("Gemini down")
        mock_factory.return_value = mock_svc

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body("abc-123"),
            )

    assert response.status_code == 500


@pytest.mark.asyncio
async def test_push_endpoint_returns_500_on_unexpected_error(app_client: AsyncClient) -> None:
    """Unexpected exceptions should return 500 to request a Pub/Sub retry."""
    with patch("app.routers.pubsub._get_ai_worker_service") as mock_factory:
        mock_svc = MagicMock()
        mock_svc.process_resume.side_effect = RuntimeError("something broke")
        mock_factory.return_value = mock_svc

        async with app_client as client:
            response = await client.post(
                "/api/v1/pubsub/push",
                json=_make_push_body("abc-123"),
            )

    assert response.status_code == 500


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
