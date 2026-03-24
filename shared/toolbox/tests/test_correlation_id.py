"""Unit tests for the correlation ID middleware."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from toolbox.middleware.correlation_id import (
    CORRELATION_ID_HEADER,
    CorrelationIdMiddleware,
    get_correlation_id,
)


def _make_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(CorrelationIdMiddleware)

    @app.get("/ping")
    async def ping() -> dict[str, str]:
        return {"correlation_id": get_correlation_id()}

    return app


class TestCorrelationIdMiddleware:
    """Tests for CorrelationIdMiddleware."""

    def test_echoes_provided_correlation_id_in_response_header(self) -> None:
        """When the client sends x-correlation-id, the same ID is returned."""
        client = TestClient(_make_app())
        resp = client.get("/ping", headers={CORRELATION_ID_HEADER: "req-abc-123"})
        assert resp.headers[CORRELATION_ID_HEADER] == "req-abc-123"

    def test_generates_uuid_when_header_absent(self) -> None:
        """When no x-correlation-id header is sent, a UUID v4 is generated."""
        client = TestClient(_make_app())
        resp = client.get("/ping")
        cid = resp.headers.get(CORRELATION_ID_HEADER, "")
        assert len(cid) == 36  # UUID4 canonical form
        assert cid.count("-") == 4

    def test_correlation_id_available_inside_handler(self) -> None:
        """get_correlation_id() returns the same ID inside the request handler."""
        client = TestClient(_make_app())
        resp = client.get("/ping", headers={CORRELATION_ID_HEADER: "trace-xyz"})
        body = resp.json()
        assert body["correlation_id"] == "trace-xyz"

    def test_different_requests_get_independent_ids(self) -> None:
        """Two requests without a supplied ID each receive a distinct generated ID."""
        client = TestClient(_make_app())
        id1 = client.get("/ping").headers[CORRELATION_ID_HEADER]
        id2 = client.get("/ping").headers[CORRELATION_ID_HEADER]
        assert id1 != id2


class TestGetCorrelationId:
    """Tests for the get_correlation_id helper outside a request context."""

    def test_returns_empty_string_outside_request(self) -> None:
        """get_correlation_id() returns '' when called without middleware context."""
        assert get_correlation_id() == ""
