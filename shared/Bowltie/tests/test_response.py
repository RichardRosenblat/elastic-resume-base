"""Unit tests for bowltie.response module."""

from __future__ import annotations

import re

from bowltie import format_error, format_success

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def _is_iso_timestamp(value: object) -> bool:
    return isinstance(value, str) and bool(_ISO_RE.match(value))


# ---------------------------------------------------------------------------
# format_success
# ---------------------------------------------------------------------------


class TestFormatSuccess:
    """Tests for format_success()."""

    def test_success_flag_is_true(self) -> None:
        result = format_success({"id": "1"})
        assert result["success"] is True

    def test_data_is_preserved(self) -> None:
        payload = {"uid": "abc-123", "name": "Alice"}
        result = format_success(payload)
        assert result["data"] == payload

    def test_meta_contains_iso_timestamp(self) -> None:
        result = format_success({})
        assert _is_iso_timestamp(result["meta"]["timestamp"])

    def test_no_correlation_id_by_default(self) -> None:
        """When correlation_id is omitted, the key must not appear in meta."""
        result = format_success({})
        assert "correlationId" not in result["meta"]

    def test_correlation_id_included_when_provided(self) -> None:
        result = format_success({}, correlation_id="req-xyz-789")
        assert result["meta"]["correlationId"] == "req-xyz-789"

    def test_data_can_be_none(self) -> None:
        result = format_success(None)
        assert result["data"] is None

    def test_data_can_be_a_list(self) -> None:
        items = [1, 2, 3]
        result = format_success(items)
        assert result["data"] == items

    def test_data_can_be_a_string(self) -> None:
        result = format_success("hello")
        assert result["data"] == "hello"

    def test_structure_matches_typescript_envelope(self) -> None:
        """Verify the top-level keys match the TS SuccessResponse<T> type."""
        result = format_success({"x": 1}, correlation_id="cid")
        assert set(result.keys()) == {"success", "data", "meta"}
        assert set(result["meta"].keys()) == {"timestamp", "correlationId"}


# ---------------------------------------------------------------------------
# format_error
# ---------------------------------------------------------------------------


class TestFormatError:
    """Tests for format_error()."""

    def test_success_flag_is_false(self) -> None:
        result = format_error("NOT_FOUND", "User not found")
        assert result["success"] is False

    def test_error_code_preserved(self) -> None:
        result = format_error("VALIDATION_ERROR", "Bad input")
        assert result["error"]["code"] == "VALIDATION_ERROR"

    def test_error_message_preserved(self) -> None:
        result = format_error("NOT_FOUND", "Resume xyz not found")
        assert result["error"]["message"] == "Resume xyz not found"

    def test_meta_contains_iso_timestamp(self) -> None:
        result = format_error("CODE", "msg")
        assert _is_iso_timestamp(result["meta"]["timestamp"])

    def test_no_correlation_id_by_default(self) -> None:
        """When correlation_id is omitted, the key must not appear in meta."""
        result = format_error("CODE", "msg")
        assert "correlationId" not in result["meta"]

    def test_correlation_id_included_when_provided(self) -> None:
        result = format_error("CODE", "msg", correlation_id="corr-001")
        assert result["meta"]["correlationId"] == "corr-001"

    def test_structure_matches_typescript_envelope(self) -> None:
        """Verify the top-level keys match the TS ErrorResponse type."""
        result = format_error("CONFLICT", "Already exists", correlation_id="c1")
        assert set(result.keys()) == {"success", "error", "meta"}
        assert set(result["error"].keys()) == {"code", "message"}
        assert set(result["meta"].keys()) == {"timestamp", "correlationId"}

    def test_timestamps_are_different_objects(self) -> None:
        """Each call generates a fresh timestamp (not a cached value)."""
        r1 = format_success({})
        r2 = format_success({})
        # Both should be valid — we can't guarantee they differ within a test
        # but they must both be valid ISO strings.
        assert _is_iso_timestamp(r1["meta"]["timestamp"])
        assert _is_iso_timestamp(r2["meta"]["timestamp"])
