"""Unit tests for the health check endpoint."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.rate_limit import limiter
from app.routers.health import router as health_router
from app.services.ai_worker_service import AIWorkerService
from toolbox.middleware.correlation_id import CorrelationIdMiddleware


@pytest.fixture()
def client(worker_service: AIWorkerService) -> TestClient:
    """Return a minimal TestClient wired only with health + correlation-ID middleware."""
    app = FastAPI()
    app.add_middleware(CorrelationIdMiddleware)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
    app.state.worker_service = worker_service
    app.include_router(health_router)

    with TestClient(app) as client:
        yield client


class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_returns_200_with_bowltie_envelope(self, client: TestClient) -> None:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["status"] == "healthy"
        assert "timestamp" in body["meta"]

    def test_echoes_correlation_id(self, client: TestClient) -> None:
        resp = client.get("/health", headers={"x-correlation-id": "hc-001"})
        assert resp.headers.get("x-correlation-id") == "hc-001"
        assert resp.json()["meta"]["correlationId"] == "hc-001"
