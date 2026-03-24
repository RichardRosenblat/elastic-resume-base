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
