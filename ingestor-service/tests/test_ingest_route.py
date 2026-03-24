"""Unit tests for the POST /ingest HTTP endpoint."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.services.ingest_service import IngestService
from tests.conftest import MockEventPublisher


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_returns_200(self, test_client: TestClient) -> None:
        """Health check returns HTTP 200."""
        response = test_client.get("/health")
        assert response.status_code == 200

    def test_returns_ok_status(self, test_client: TestClient) -> None:
        """Health check response contains status: ok."""
        response = test_client.get("/health")
        assert response.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# POST /api/v1/ingest
# ---------------------------------------------------------------------------


class TestIngestEndpoint:
    """Tests for POST /api/v1/ingest."""

    def test_returns_202_with_sheet_id(self, test_client: TestClient) -> None:
        """Returns HTTP 202 when sheet_id is provided."""
        response = test_client.post("/api/v1/ingest", json={"sheet_id": "sheet-abc"})
        assert response.status_code == 202

    def test_returns_202_with_batch_id(self, test_client: TestClient) -> None:
        """Returns HTTP 202 when batch_id is provided."""
        response = test_client.post("/api/v1/ingest", json={"batch_id": "batch-001"})
        assert response.status_code == 202

    def test_response_envelope_success_true(self, test_client: TestClient) -> None:
        """Response envelope has success=True."""
        response = test_client.post("/api/v1/ingest", json={"sheet_id": "sheet-abc"})
        body = response.json()
        assert body["success"] is True

    def test_response_contains_job_id(self, test_client: TestClient) -> None:
        """Response data contains a jobId field (camelCase for BFF compatibility)."""
        response = test_client.post("/api/v1/ingest", json={"sheet_id": "sheet-abc"})
        body = response.json()
        assert "jobId" in body["data"]
        assert body["data"]["jobId"].startswith("job-")

    def test_response_status_is_accepted(self, test_client: TestClient) -> None:
        """Response data status is 'accepted'."""
        response = test_client.post("/api/v1/ingest", json={"sheet_id": "sheet-abc"})
        body = response.json()
        assert body["data"]["status"] == "accepted"

    def test_response_contains_accepted_at(self, test_client: TestClient) -> None:
        """Response data contains an ISO-8601 acceptedAt timestamp (camelCase)."""
        from datetime import datetime

        response = test_client.post("/api/v1/ingest", json={"sheet_id": "sheet-abc"})
        body = response.json()
        accepted_at = body["data"]["acceptedAt"]
        # Should not raise
        dt = datetime.fromisoformat(accepted_at)
        assert dt is not None

    def test_response_contains_meta_with_timestamp(self, test_client: TestClient) -> None:
        """Response meta contains a timestamp."""
        response = test_client.post("/api/v1/ingest", json={"sheet_id": "sheet-abc"})
        body = response.json()
        assert "meta" in body
        assert "timestamp" in body["meta"]

    def test_returns_400_when_no_sheet_or_batch(self, test_client: TestClient) -> None:
        """Returns HTTP 400 when neither sheet_id nor batch_id is provided."""
        response = test_client.post("/api/v1/ingest", json={})
        assert response.status_code == 400

    def test_returns_400_error_envelope(self, test_client: TestClient) -> None:
        """Returns a well-formed error envelope on validation failure."""
        response = test_client.post("/api/v1/ingest", json={})
        body = response.json()
        assert body["success"] is False
        assert "error" in body
        assert body["error"]["code"] == "VALIDATION_ERROR"

    def test_returns_400_for_empty_body(self, test_client: TestClient) -> None:
        """Returns HTTP 400 for an empty JSON body."""
        response = test_client.post("/api/v1/ingest", json={})
        assert response.status_code == 400

    def test_accepts_optional_metadata(self, test_client: TestClient) -> None:
        """Returns HTTP 202 when metadata is provided alongside sheet_id."""
        response = test_client.post(
            "/api/v1/ingest",
            json={
                "sheet_id": "sheet-abc",
                "metadata": {"campaign": "spring-2026", "owner": "alice@example.com"},
            },
        )
        assert response.status_code == 202

    def test_job_ids_are_unique_per_request(self, test_client: TestClient) -> None:
        """Each request generates a unique jobId."""
        r1 = test_client.post("/api/v1/ingest", json={"sheet_id": "s1"})
        r2 = test_client.post("/api/v1/ingest", json={"sheet_id": "s2"})
        assert r1.json()["data"]["jobId"] != r2.json()["data"]["jobId"]


# ---------------------------------------------------------------------------
# Correlation ID
# ---------------------------------------------------------------------------


class TestCorrelationId:
    """Tests for x-correlation-id header handling."""

    def test_response_echoes_incoming_correlation_id(self, test_client: TestClient) -> None:
        """When x-correlation-id is sent, it is echoed in the response header."""
        cid = "trace-abc-123"
        response = test_client.post(
            "/api/v1/ingest",
            json={"sheet_id": "sheet-abc"},
            headers={"x-correlation-id": cid},
        )
        assert response.headers.get("x-correlation-id") == cid

    def test_response_generates_correlation_id_when_absent(self, test_client: TestClient) -> None:
        """When no x-correlation-id is sent, the server generates one."""
        response = test_client.post("/api/v1/ingest", json={"sheet_id": "sheet-abc"})
        assert "x-correlation-id" in response.headers
        assert response.headers["x-correlation-id"]

    def test_correlation_id_in_response_meta(self, test_client: TestClient) -> None:
        """The correlation ID appears in the Bowltie response meta envelope."""
        cid = "my-trace-id"
        response = test_client.post(
            "/api/v1/ingest",
            json={"sheet_id": "sheet-abc"},
            headers={"x-correlation-id": cid},
        )
        body = response.json()
        assert body["meta"].get("correlationId") == cid

    def test_health_endpoint_generates_correlation_id(self, test_client: TestClient) -> None:
        """Health check also gets a correlation ID response header."""
        response = test_client.get("/health")
        assert "x-correlation-id" in response.headers


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


class TestRateLimiting:
    """Tests for rate-limit configuration via Settings."""

    def test_rate_limit_configured_on_app_state(self, test_settings: Settings) -> None:
        """The app.state.rate_limit string reflects Settings values."""
        from app.main import create_app
        from app.services.ingest_service import IngestService
        from unittest.mock import MagicMock

        # Minimal IngestService mock.
        mock_service = MagicMock(spec=IngestService)
        settings = Settings(
            port=8001,
            gcp_project_id="test",
            ingest_rate_limit_max_requests=5,
            ingest_rate_limit_window_seconds=30,
            max_ai_calls_per_batch=10,
        )
        app = create_app(settings=settings, ingest_service=mock_service)
        assert app.state.rate_limit == "5/30second"

    def test_rate_limit_default_values_from_config(self) -> None:
        """Default rate limit values are read from Settings defaults."""
        settings = Settings(gcp_project_id="test")
        assert settings.ingest_rate_limit_max_requests == 10
        assert settings.ingest_rate_limit_window_seconds == 60


# ---------------------------------------------------------------------------
# AI call cap in settings
# ---------------------------------------------------------------------------


class TestAiCallCapSettings:
    """Tests that Settings exposes the AI call cap."""

    def test_default_max_ai_calls_per_batch(self) -> None:
        """Default max_ai_calls_per_batch is 50."""
        settings = Settings(gcp_project_id="test")
        assert settings.max_ai_calls_per_batch == 50

    def test_max_ai_calls_per_batch_zero_means_unlimited(self) -> None:
        """max_ai_calls_per_batch=0 is a valid 'unlimited' configuration."""
        settings = Settings(gcp_project_id="test", max_ai_calls_per_batch=0)
        assert settings.max_ai_calls_per_batch == 0
