"""Unit tests for toolbox_py.middleware module."""

from __future__ import annotations

import re
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from toolbox_py import (
    CorrelationIdMiddleware,
    get_correlation_id,
    get_span_id,
    get_trace_id,
)
from toolbox_py.middleware import _parse_cloud_trace_context  # noqa: PLC2701


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _make_app() -> Starlette:
    """Return a minimal Starlette app with CorrelationIdMiddleware."""

    async def homepage(request: Request) -> PlainTextResponse:
        return PlainTextResponse(
            f"{get_correlation_id()}|{get_trace_id()}|{get_span_id()}"
        )

    app = Starlette(routes=[Route("/", homepage)])
    app.add_middleware(CorrelationIdMiddleware)
    return app


# ─── _parse_cloud_trace_context ───────────────────────────────────────────────


class TestParseCloudTraceContext:
    def test_valid_header_returns_trace_and_span(self) -> None:
        trace_id = "a1b2c3d4e5f60718293a4b5c6d7e8f90"
        span_id = "12345"
        result = _parse_cloud_trace_context(f"{trace_id}/{span_id};o=1")
        assert result == (trace_id, span_id)

    def test_valid_header_without_flag(self) -> None:
        trace_id = "a1b2c3d4e5f60718293a4b5c6d7e8f90"
        span_id = "0"
        result = _parse_cloud_trace_context(f"{trace_id}/{span_id}")
        assert result == (trace_id, span_id)

    def test_trace_id_is_lowercased(self) -> None:
        result = _parse_cloud_trace_context("A1B2C3D4E5F60718293A4B5C6D7E8F90/1;o=1")
        assert result is not None
        assert result[0] == "a1b2c3d4e5f60718293a4b5c6d7e8f90"

    def test_none_returns_none(self) -> None:
        assert _parse_cloud_trace_context(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert _parse_cloud_trace_context("") is None

    def test_malformed_header_returns_none(self) -> None:
        assert _parse_cloud_trace_context("not-a-valid-trace") is None

    def test_short_trace_id_returns_none(self) -> None:
        # Trace ID must be exactly 32 hex chars
        assert _parse_cloud_trace_context("abc123/0;o=1") is None

    def test_non_decimal_span_id_returns_none(self) -> None:
        trace_id = "a1b2c3d4e5f60718293a4b5c6d7e8f90"
        assert _parse_cloud_trace_context(f"{trace_id}/abc;o=1") is None


# ─── CorrelationIdMiddleware ──────────────────────────────────────────────────


class TestCorrelationIdMiddleware:
    @pytest.mark.asyncio
    async def test_uses_existing_correlation_id_header(self) -> None:
        app = _make_app()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/", headers={"x-correlation-id": "existing-123"})

        assert response.status_code == 200
        assert response.headers["x-correlation-id"] == "existing-123"
        # Context variable is reflected in body
        body_parts = response.text.split("|")
        assert body_parts[0] == "existing-123"

    @pytest.mark.asyncio
    async def test_generates_correlation_id_when_absent(self) -> None:
        app = _make_app()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/")

        assert response.status_code == 200
        generated = response.headers["x-correlation-id"]
        assert re.match(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
            generated,
        )

    @pytest.mark.asyncio
    async def test_parses_cloud_trace_context_header(self) -> None:
        trace_id = "a1b2c3d4e5f60718293a4b5c6d7e8f90"
        span_id = "99"
        app = _make_app()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/",
                headers={"x-cloud-trace-context": f"{trace_id}/{span_id};o=1"},
            )

        body_parts = response.text.split("|")
        assert body_parts[1] == trace_id
        assert body_parts[2] == span_id
        assert response.headers["x-cloud-trace-context"] == f"{trace_id}/{span_id};o=1"

    @pytest.mark.asyncio
    async def test_derives_trace_id_from_correlation_id_when_no_trace_header(self) -> None:
        correlation_id = "550e8400-e29b-41d4-a716-446655440000"
        expected_trace_id = "550e8400e29b41d4a716446655440000"
        app = _make_app()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/", headers={"x-correlation-id": correlation_id}
            )

        body_parts = response.text.split("|")
        assert body_parts[1] == expected_trace_id
        assert body_parts[2] == "0"

    @pytest.mark.asyncio
    async def test_x_cloud_trace_context_response_header_has_correct_format(self) -> None:
        app = _make_app()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/")

        header = response.headers["x-cloud-trace-context"]
        assert re.match(r"^[0-9a-f]{32}/[0-9]+;o=1$", header), (
            f"Unexpected x-cloud-trace-context value: {header!r}"
        )

    @pytest.mark.asyncio
    async def test_malformed_trace_header_falls_back_to_derived(self) -> None:
        correlation_id = str(uuid.uuid4())
        expected_trace_id = correlation_id.replace("-", "")
        app = _make_app()
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/",
                headers={
                    "x-correlation-id": correlation_id,
                    "x-cloud-trace-context": "invalid-header-value",
                },
            )

        body_parts = response.text.split("|")
        assert body_parts[1] == expected_trace_id
        assert body_parts[2] == "0"


# ─── Context accessor helpers ─────────────────────────────────────────────────


class TestContextAccessors:
    def test_get_correlation_id_returns_empty_outside_request(self) -> None:
        assert get_correlation_id() == ""

    def test_get_trace_id_returns_empty_outside_request(self) -> None:
        assert get_trace_id() == ""

    def test_get_span_id_returns_empty_outside_request(self) -> None:
        assert get_span_id() == ""
