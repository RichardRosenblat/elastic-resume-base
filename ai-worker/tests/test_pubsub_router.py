"""Unit tests for the Pub/Sub push router."""

from __future__ import annotations

import base64
import json
from unittest.mock import AsyncMock, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers.pubsub import router


def _encode(payload: dict) -> str:  # type: ignore[type-arg]
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")


def _make_test_client(worker_service: MagicMock) -> TestClient:
    """Create a TestClient with a mocked worker_service on app state."""
    app = FastAPI()
    app.include_router(router)
    app.state.worker_service = worker_service
    return TestClient(app, raise_server_exceptions=False)


def _push_body(resume_id: str = "resume-123") -> dict:  # type: ignore[type-arg]
    return {
        "message": {
            "data": _encode({"resumeId": resume_id}),
            "message_id": "msg-001",
        },
        "subscription": "projects/demo/subscriptions/resume-ingested-sub",
    }


class TestPubSubPushEndpoint:
    """Tests for POST /pubsub/push."""

    def test_returns_204_on_success(self) -> None:
        """204 is returned when processing succeeds."""
        worker = MagicMock()
        worker.process = AsyncMock()
        client = _make_test_client(worker)

        response = client.post("/pubsub/push", json=_push_body())

        assert response.status_code == 204
        worker.process.assert_called_once_with("resume-123")

    def test_returns_400_when_resume_id_missing(self) -> None:
        """400 is returned when the message payload has no resumeId."""
        worker = MagicMock()
        worker.process = AsyncMock()
        body = {
            "message": {
                "data": _encode({"other_field": "value"}),
                "message_id": "msg-002",
            },
            "subscription": "projects/demo/subscriptions/resume-ingested-sub",
        }
        client = _make_test_client(worker)

        response = client.post("/pubsub/push", json=body)

        assert response.status_code == 400
        worker.process.assert_not_called()

    def test_returns_400_when_payload_not_valid_json(self) -> None:
        """400 is returned when the base64 data is not valid JSON."""
        worker = MagicMock()
        worker.process = AsyncMock()
        bad_data = base64.b64encode(b"not-json").decode("utf-8")
        body = {
            "message": {"data": bad_data, "message_id": "msg-003"},
            "subscription": "projects/demo/subscriptions/resume-ingested-sub",
        }
        client = _make_test_client(worker)

        response = client.post("/pubsub/push", json=body)

        assert response.status_code == 400

    def test_returns_500_when_worker_raises(self) -> None:
        """500 is returned when the worker service raises an exception."""
        worker = MagicMock()
        worker.process = AsyncMock(side_effect=RuntimeError("pipeline failure"))
        client = _make_test_client(worker)

        response = client.post("/pubsub/push", json=_push_body())

        assert response.status_code == 500

    def test_returns_422_on_malformed_envelope(self) -> None:
        """422 is returned when the request body is not a valid push envelope."""
        worker = MagicMock()
        worker.process = AsyncMock()
        client = _make_test_client(worker)

        response = client.post("/pubsub/push", json={"not": "valid"})

        assert response.status_code == 422
