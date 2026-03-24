"""Unit tests for the request logger middleware."""

from __future__ import annotations

import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from toolbox.middleware.correlation_id import CorrelationIdMiddleware
from toolbox.middleware.request_logger import RequestLoggerMiddleware


def _make_app(logger_name: str = "test.http") -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestLoggerMiddleware, logger_name=logger_name)
    app.add_middleware(CorrelationIdMiddleware)

    @app.get("/ok")
    async def ok() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/fail")
    async def fail() -> None:
        raise ValueError("boom")

    return app


class TestRequestLoggerMiddleware:
    """Tests for RequestLoggerMiddleware."""

    def test_logs_successful_request(self, caplog: pytest.LogCaptureFixture) -> None:
        """A successful request produces an INFO log entry with key fields."""
        with caplog.at_level(logging.INFO, logger="test.http"):
            client = TestClient(_make_app())
            resp = client.get("/ok")

        assert resp.status_code == 200
        records = [r for r in caplog.records if r.name == "test.http"]
        assert len(records) == 1
        rec = records[0]
        assert rec.getMessage() == "HTTP request"
        assert rec.__dict__["method"] == "GET"
        assert rec.__dict__["path"] == "/ok"
        assert rec.__dict__["status_code"] == 200
        assert rec.__dict__["duration_ms"] >= 0

    def test_includes_correlation_id_in_log(self, caplog: pytest.LogCaptureFixture) -> None:
        """The log entry includes the correlation ID from the request."""
        with caplog.at_level(logging.INFO, logger="test.http"):
            client = TestClient(_make_app())
            client.get("/ok", headers={"x-correlation-id": "cid-001"})

        records = [r for r in caplog.records if r.name == "test.http"]
        assert records[0].__dict__["correlation_id"] == "cid-001"
