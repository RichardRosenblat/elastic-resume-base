"""Unit tests for the Toolbox error hierarchy."""

from __future__ import annotations

import pytest

from toolbox.errors import (
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
    """Tests for AppError base class."""

    def test_stores_message_status_code_and_code(self) -> None:
        err = AppError("Something broke", 500, "INTERNAL_ERROR")
        assert str(err) == "Something broke"
        assert err.status_code == 500
        assert err.code == "INTERNAL_ERROR"

    def test_is_exception_subclass(self) -> None:
        assert isinstance(AppError("msg", 500, "ERR"), Exception)


class TestDomainErrors:
    """Tests for each concrete domain error class."""

    @pytest.mark.parametrize(
        "cls, status_code, code",
        [
            (NotFoundError, 404, "NOT_FOUND"),
            (UnauthorizedError, 401, "UNAUTHORIZED"),
            (ValidationError, 400, "VALIDATION_ERROR"),
            (ConflictError, 409, "CONFLICT"),
            (ForbiddenError, 403, "FORBIDDEN"),
            (UnavailableError, 503, "SERVICE_UNAVAILABLE"),
            (RateLimitError, 429, "RATE_LIMIT_EXCEEDED"),
        ],
    )
    def test_default_status_code_and_code(
        self, cls: type[AppError], status_code: int, code: str
    ) -> None:
        """Default constructor sets the correct status code and machine code."""
        err = cls()
        assert err.status_code == status_code
        assert err.code == code

    @pytest.mark.parametrize(
        "cls",
        [
            NotFoundError,
            UnauthorizedError,
            ValidationError,
            ConflictError,
            ForbiddenError,
            UnavailableError,
            RateLimitError,
        ],
    )
    def test_custom_message_is_preserved(self, cls: type[AppError]) -> None:
        """A custom message passed to the constructor is preserved."""
        err = cls("Custom message")
        assert str(err) == "Custom message"

    def test_downstream_error_defaults(self) -> None:
        err = DownstreamError()
        assert err.status_code == 502
        assert err.code == "DOWNSTREAM_ERROR"

    def test_downstream_error_custom_code(self) -> None:
        err = DownstreamError("bad response", 502, "VERTEX_AI_ERROR")
        assert err.code == "VERTEX_AI_ERROR"

    def test_all_domain_errors_are_app_errors(self) -> None:
        for cls in (
            NotFoundError,
            UnauthorizedError,
            ValidationError,
            ConflictError,
            ForbiddenError,
            DownstreamError,
            UnavailableError,
            RateLimitError,
        ):
            assert isinstance(cls(), AppError)


class TestIsAppError:
    """Tests for the is_app_error helper."""

    def test_returns_true_for_app_error(self) -> None:
        assert is_app_error(AppError("msg", 500, "ERR")) is True

    def test_returns_true_for_subclass(self) -> None:
        assert is_app_error(NotFoundError()) is True

    def test_returns_false_for_plain_exception(self) -> None:
        assert is_app_error(ValueError("oops")) is False

    def test_returns_false_for_non_exception(self) -> None:
        assert is_app_error("a string") is False

    def test_returns_false_for_none(self) -> None:
        assert is_app_error(None) is False
