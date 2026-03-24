"""Unit tests for the CorrelationIdMiddleware."""

from __future__ import annotations

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from toolbox.middleware import CORRELATION_ID_HEADER, CorrelationIdMiddleware


def _build_app() -> FastAPI:
    """Build a minimal FastAPI app with CorrelationIdMiddleware."""
    app = FastAPI()
    app.add_middleware(CorrelationIdMiddleware)

    @app.get("/test")
    async def test_route(request: Request) -> JSONResponse:
        return JSONResponse(
            content={"correlationId": request.state.correlation_id}
        )

    return app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(_build_app())


class TestCorrelationIdMiddleware:
    """Tests for CorrelationIdMiddleware."""

    def test_generates_correlation_id_when_header_absent(
        self, client: TestClient
    ) -> None:
        """A UUID is generated when no x-correlation-id header is sent."""
        response = client.get("/test")
        assert response.status_code == 200
        body = response.json()
        cid = body["correlationId"]
        assert cid  # non-empty
        # UUID v4 format: 8-4-4-4-12 hex chars
        import re
        assert re.match(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
            cid,
        )

    def test_uses_incoming_correlation_id_header(self, client: TestClient) -> None:
        """The incoming x-correlation-id header is used verbatim."""
        cid = "my-custom-correlation-id"
        response = client.get("/test", headers={CORRELATION_ID_HEADER: cid})
        body = response.json()
        assert body["correlationId"] == cid

    def test_echoes_correlation_id_in_response_header(
        self, client: TestClient
    ) -> None:
        """The resolved correlation ID is echoed in the response header."""
        cid = "trace-abc-123"
        response = client.get("/test", headers={CORRELATION_ID_HEADER: cid})
        assert response.headers.get(CORRELATION_ID_HEADER) == cid

    def test_response_header_present_when_no_incoming_header(
        self, client: TestClient
    ) -> None:
        """A generated correlation ID is still present in the response header."""
        response = client.get("/test")
        assert CORRELATION_ID_HEADER in response.headers
        assert response.headers[CORRELATION_ID_HEADER]

    def test_each_request_gets_unique_correlation_id(
        self, client: TestClient
    ) -> None:
        """Two requests without an incoming header get different correlation IDs."""
        r1 = client.get("/test")
        r2 = client.get("/test")
        cid1 = r1.headers.get(CORRELATION_ID_HEADER)
        cid2 = r2.headers.get(CORRELATION_ID_HEADER)
        assert cid1 != cid2

    def test_state_correlation_id_matches_response_header(
        self, client: TestClient
    ) -> None:
        """request.state.correlation_id equals the response header value."""
        cid = "header-and-state-match"
        response = client.get("/test", headers={CORRELATION_ID_HEADER: cid})
        assert response.json()["correlationId"] == cid
        assert response.headers.get(CORRELATION_ID_HEADER) == cid
