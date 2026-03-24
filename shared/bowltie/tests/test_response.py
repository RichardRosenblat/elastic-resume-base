"""Unit tests for bowltie.response."""

from __future__ import annotations

import pytest

from bowltie.response import ErrorResponse, SuccessResponse, format_error, format_success


class TestFormatSuccess:
    """Tests for format_success()."""

    def test_success_flag_is_true(self) -> None:
        assert format_success({"x": 1}).success is True

    def test_data_is_preserved(self) -> None:
        assert format_success({"resumeId": "abc"}).data == {"resumeId": "abc"}

    def test_meta_timestamp_is_iso_string(self) -> None:
        meta = format_success({}).meta
        # Must be parseable as ISO-8601
        from datetime import datetime
        dt = datetime.fromisoformat(meta.timestamp)
        assert dt is not None

    def test_meta_includes_correlation_id(self) -> None:
        resp = format_success({}, correlation_id="req-123")
        assert resp.meta.correlation_id == "req-123"

    def test_meta_correlation_id_none_by_default(self) -> None:
        assert format_success({}).meta.correlation_id is None

    def test_json_serialisation_contains_expected_keys(self) -> None:
        resp = format_success({"k": "v"}, correlation_id="cid")
        body = resp.model_dump(by_alias=True)
        assert body["success"] is True
        assert body["data"] == {"k": "v"}
        assert "timestamp" in body["meta"]
        assert body["meta"]["correlationId"] == "cid"

    def test_works_with_arbitrary_payload_types(self) -> None:
        assert format_success([1, 2, 3]).data == [1, 2, 3]
        assert format_success("plain string").data == "plain string"
        assert format_success(42).data == 42


class TestFormatError:
    """Tests for format_error()."""

    def test_success_flag_is_false(self) -> None:
        assert format_error("ERR", "msg").success is False

    def test_error_code_and_message_preserved(self) -> None:
        resp = format_error("NOT_FOUND", "Resume not found")
        assert resp.error["code"] == "NOT_FOUND"
        assert resp.error["message"] == "Resume not found"

    def test_meta_includes_correlation_id(self) -> None:
        resp = format_error("ERR", "msg", correlation_id="cid-999")
        assert resp.meta.correlation_id == "cid-999"

    def test_meta_correlation_id_none_by_default(self) -> None:
        assert format_error("ERR", "msg").meta.correlation_id is None

    def test_json_serialisation_contains_expected_keys(self) -> None:
        resp = format_error("VALIDATION_ERROR", "Bad input", "cid")
        body = resp.model_dump(by_alias=True)
        assert body["success"] is False
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert "timestamp" in body["meta"]
        assert body["meta"]["correlationId"] == "cid"


class TestResponseTypes:
    """Tests that SuccessResponse and ErrorResponse are distinguishable."""

    def test_success_response_is_instance_of_success_response(self) -> None:
        assert isinstance(format_success({}), SuccessResponse)

    def test_error_response_is_instance_of_error_response(self) -> None:
        assert isinstance(format_error("E", "m"), ErrorResponse)

    def test_success_flag_discriminates_types(self) -> None:
        responses = [format_success({}), format_error("E", "m")]
        successes = [r for r in responses if r.success]
        errors = [r for r in responses if not r.success]
        assert len(successes) == 1
        assert len(errors) == 1
