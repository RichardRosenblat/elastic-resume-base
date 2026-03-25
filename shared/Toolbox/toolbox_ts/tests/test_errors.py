"""Unit tests for toolbox.errors module."""

from __future__ import annotations

import pytest
from toolbox import (
    AppError,
    ConflictError,
    DownstreamError,
    ForbiddenError,
    NotFoundError,
    RateLimitError,
    UnauthorizedError,
    UnavailableError,
    ValidationError,
    is_app_error,
)


class TestAppError:
    """Tests for the base AppError class."""

    def test_message_stored_on_instance(self) -> None:
        """The message passed to AppError is accessible via .message."""
        err = AppError("something went wrong")
        assert err.message == "something went wrong"

    def test_default_status_code(self) -> None:
        """AppError defaults to HTTP 500."""
        assert AppError.status_code == 500

    def test_default_code(self) -> None:
        """AppError defaults to INTERNAL_ERROR code."""
        assert AppError.code == "INTERNAL_ERROR"

    def test_is_exception(self) -> None:
        """AppError is raiseable as a standard Python exception."""
        with pytest.raises(AppError):
            raise AppError("test")

    def test_repr_contains_key_info(self) -> None:
        """repr() includes message, code, and status_code."""
        err = AppError("oops")
        r = repr(err)
        assert "oops" in r
        assert "INTERNAL_ERROR" in r
        assert "500" in r


class TestNotFoundError:
    def test_status_code_is_404(self) -> None:
        assert NotFoundError().status_code == 404

    def test_code_is_not_found(self) -> None:
        assert NotFoundError().code == "NOT_FOUND"

    def test_custom_message(self) -> None:
        err = NotFoundError("Resume xyz not found")
        assert err.message == "Resume xyz not found"

    def test_default_message(self) -> None:
        err = NotFoundError()
        assert err.message == "Resource not found"

    def test_is_app_error_subclass(self) -> None:
        assert isinstance(NotFoundError(), AppError)


class TestUnauthorizedError:
    def test_status_code_is_401(self) -> None:
        assert UnauthorizedError().status_code == 401

    def test_code_is_unauthorized(self) -> None:
        assert UnauthorizedError().code == "UNAUTHORIZED"


class TestValidationError:
    def test_status_code_is_400(self) -> None:
        assert ValidationError().status_code == 400

    def test_code_is_validation_error(self) -> None:
        assert ValidationError().code == "VALIDATION_ERROR"


class TestConflictError:
    def test_status_code_is_409(self) -> None:
        assert ConflictError().status_code == 409

    def test_code_is_conflict(self) -> None:
        assert ConflictError().code == "CONFLICT"


class TestForbiddenError:
    def test_status_code_is_403(self) -> None:
        assert ForbiddenError().status_code == 403

    def test_code_is_forbidden(self) -> None:
        assert ForbiddenError().code == "FORBIDDEN"


class TestDownstreamError:
    def test_status_code_is_502(self) -> None:
        assert DownstreamError().status_code == 502

    def test_code_is_downstream_error(self) -> None:
        assert DownstreamError().code == "DOWNSTREAM_ERROR"


class TestUnavailableError:
    def test_status_code_is_503(self) -> None:
        assert UnavailableError().status_code == 503

    def test_code_is_service_unavailable(self) -> None:
        assert UnavailableError().code == "SERVICE_UNAVAILABLE"


class TestRateLimitError:
    def test_status_code_is_429(self) -> None:
        assert RateLimitError().status_code == 429

    def test_code_is_rate_limit_exceeded(self) -> None:
        assert RateLimitError().code == "RATE_LIMIT_EXCEEDED"


class TestIsAppError:
    """Tests for the is_app_error() helper."""

    def test_returns_true_for_app_error(self) -> None:
        assert is_app_error(AppError("x")) is True

    def test_returns_true_for_subclass(self) -> None:
        assert is_app_error(NotFoundError()) is True

    def test_returns_false_for_plain_exception(self) -> None:
        assert is_app_error(ValueError("bad value")) is False

    def test_returns_false_for_non_exception(self) -> None:
        assert is_app_error(RuntimeError("runtime")) is False

    def test_all_subclasses_are_app_errors(self) -> None:
        error_classes = [
            NotFoundError,
            UnauthorizedError,
            ValidationError,
            ConflictError,
            ForbiddenError,
            DownstreamError,
            UnavailableError,
            RateLimitError,
        ]
        for cls in error_classes:
            assert is_app_error(cls()), f"{cls.__name__} should be an AppError"
