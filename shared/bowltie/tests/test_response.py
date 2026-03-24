"""Unit tests for the Bowltie response formatting module."""

from __future__ import annotations

from datetime import timezone

import pytest

from bowltie import format_error, format_success
from bowltie.response import ErrorDetail, ErrorResponse, ResponseMeta, SuccessResponse


# ---------------------------------------------------------------------------
# ResponseMeta
# ---------------------------------------------------------------------------


class TestResponseMeta:
    """Tests for ResponseMeta."""

    def test_to_dict_includes_timestamp(self) -> None:
        """to_dict always includes the timestamp key."""
        meta = ResponseMeta(timestamp="2026-01-15T10:30:00.000000+00:00")
        result = meta.to_dict()
        assert result["timestamp"] == "2026-01-15T10:30:00.000000+00:00"

    def test_to_dict_omits_correlation_id_when_none(self) -> None:
        """correlation_id is not included when it is None."""
        meta = ResponseMeta(timestamp="2026-01-15T10:30:00.000000+00:00")
        result = meta.to_dict()
        assert "correlationId" not in result

    def test_to_dict_includes_correlation_id_when_set(self) -> None:
        """correlation_id is serialised as correlationId when provided."""
        meta = ResponseMeta(
            timestamp="2026-01-15T10:30:00.000000+00:00",
            correlation_id="req-abc123",
        )
        result = meta.to_dict()
        assert result["correlationId"] == "req-abc123"


# ---------------------------------------------------------------------------
# SuccessResponse
# ---------------------------------------------------------------------------


class TestSuccessResponse:
    """Tests for SuccessResponse."""

    def test_success_is_true(self) -> None:
        """success field is always True."""
        meta = ResponseMeta(timestamp="2026-01-01T00:00:00.000000+00:00")
        resp = SuccessResponse(success=True, data={"key": "value"}, meta=meta)
        assert resp.success is True

    def test_to_dict_structure(self) -> None:
        """to_dict returns the correct top-level keys."""
        meta = ResponseMeta(timestamp="2026-01-01T00:00:00.000000+00:00")
        resp = SuccessResponse(success=True, data={"key": "value"}, meta=meta)
        result = resp.to_dict()
        assert result["success"] is True
        assert result["data"] == {"key": "value"}
        assert "meta" in result


# ---------------------------------------------------------------------------
# ErrorResponse
# ---------------------------------------------------------------------------


class TestErrorResponse:
    """Tests for ErrorResponse."""

    def test_success_is_false(self) -> None:
        """success field is always False."""
        meta = ResponseMeta(timestamp="2026-01-01T00:00:00.000000+00:00")
        resp = ErrorResponse(
            success=False,
            error=ErrorDetail(code="NOT_FOUND", message="Not found"),
            meta=meta,
        )
        assert resp.success is False

    def test_to_dict_structure(self) -> None:
        """to_dict returns the correct top-level keys."""
        meta = ResponseMeta(timestamp="2026-01-01T00:00:00.000000+00:00")
        resp = ErrorResponse(
            success=False,
            error=ErrorDetail(code="NOT_FOUND", message="Not found"),
            meta=meta,
        )
        result = resp.to_dict()
        assert result["success"] is False
        assert result["error"] == {"code": "NOT_FOUND", "message": "Not found"}
        assert "meta" in result


# ---------------------------------------------------------------------------
# format_success
# ---------------------------------------------------------------------------


class TestFormatSuccess:
    """Tests for format_success()."""

    def test_returns_success_response(self) -> None:
        """Returns a SuccessResponse instance."""
        resp = format_success({"resumeId": "abc123"})
        assert isinstance(resp, SuccessResponse)

    def test_success_is_true(self) -> None:
        """The success field is True."""
        resp = format_success({"resumeId": "abc123"})
        assert resp.success is True

    def test_data_is_preserved(self) -> None:
        """The data payload is preserved exactly."""
        payload = {"resumeId": "abc123", "status": "INGESTED"}
        resp = format_success(payload)
        assert resp.data == payload

    def test_timestamp_is_iso_8601(self) -> None:
        """The meta.timestamp is an ISO-8601 string."""
        from datetime import datetime

        resp = format_success({"key": "value"})
        # Should not raise
        dt = datetime.fromisoformat(resp.meta.timestamp)
        assert dt.tzinfo is not None

    def test_correlation_id_included_when_provided(self) -> None:
        """correlation_id is forwarded to the meta."""
        resp = format_success({"key": "value"}, correlation_id="req-001")
        assert resp.meta.correlation_id == "req-001"

    def test_correlation_id_is_none_when_not_provided(self) -> None:
        """correlation_id defaults to None."""
        resp = format_success({"key": "value"})
        assert resp.meta.correlation_id is None

    def test_to_dict_has_correct_structure(self) -> None:
        """to_dict returns the expected canonical shape."""
        resp = format_success({"resumeId": "r1"}, correlation_id="c-1")
        d = resp.to_dict()
        assert d["success"] is True
        assert d["data"] == {"resumeId": "r1"}
        assert "meta" in d
        assert d["meta"]["correlationId"] == "c-1"
        assert "timestamp" in d["meta"]

    def test_works_with_non_dict_data(self) -> None:
        """format_success works with any data type (list, string, int)."""
        assert format_success([1, 2, 3]).data == [1, 2, 3]
        assert format_success("hello").data == "hello"
        assert format_success(42).data == 42


# ---------------------------------------------------------------------------
# format_error
# ---------------------------------------------------------------------------


class TestFormatError:
    """Tests for format_error()."""

    def test_returns_error_response(self) -> None:
        """Returns an ErrorResponse instance."""
        resp = format_error("NOT_FOUND", "Resume not found")
        assert isinstance(resp, ErrorResponse)

    def test_success_is_false(self) -> None:
        """The success field is False."""
        resp = format_error("NOT_FOUND", "Resume not found")
        assert resp.success is False

    def test_error_code_and_message_preserved(self) -> None:
        """The error code and message are preserved."""
        resp = format_error("VALIDATION_ERROR", "sheetId is required")
        assert resp.error.code == "VALIDATION_ERROR"
        assert resp.error.message == "sheetId is required"

    def test_correlation_id_included_when_provided(self) -> None:
        """correlation_id is forwarded to the meta."""
        resp = format_error("NOT_FOUND", "Not found", correlation_id="req-xyz")
        assert resp.meta.correlation_id == "req-xyz"

    def test_correlation_id_is_none_when_not_provided(self) -> None:
        """correlation_id defaults to None."""
        resp = format_error("NOT_FOUND", "Not found")
        assert resp.meta.correlation_id is None

    def test_to_dict_has_correct_structure(self) -> None:
        """to_dict returns the expected canonical shape."""
        resp = format_error("INTERNAL_ERROR", "Unexpected error", correlation_id="c-2")
        d = resp.to_dict()
        assert d["success"] is False
        assert d["error"]["code"] == "INTERNAL_ERROR"
        assert d["error"]["message"] == "Unexpected error"
        assert "meta" in d
        assert d["meta"]["correlationId"] == "c-2"
        assert "timestamp" in d["meta"]

    def test_to_dict_omits_correlation_id_when_none(self) -> None:
        """to_dict omits correlationId key when not provided."""
        resp = format_error("ERR", "msg")
        d = resp.to_dict()
        assert "correlationId" not in d["meta"]
