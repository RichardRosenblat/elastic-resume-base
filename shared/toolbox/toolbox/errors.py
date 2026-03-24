"""Canonical application-level error classes for Elastic Resume Base.

Each class maps a domain error to an HTTP status code and a machine-readable
code string, mirroring the TypeScript Toolbox ``errors.ts`` module.

Example::

    from toolbox.errors import NotFoundError, is_app_error

    try:
        raise NotFoundError("Resume abc123 not found")
    except Exception as exc:
        if is_app_error(exc):
            print(exc.status_code, exc.code)   # 404  NOT_FOUND
"""

from __future__ import annotations


class AppError(Exception):
    """Base class for application errors with an HTTP status code and machine-readable code.

    All domain errors should subclass this so that error-handling middleware
    can produce consistent HTTP responses without inspecting message strings.

    Attributes:
        status_code: HTTP status code that should accompany this error.
        code: Machine-readable, uppercase underscore error code
            (e.g. ``"NOT_FOUND"``).
    """

    def __init__(self, message: str, status_code: int, code: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code


class NotFoundError(AppError):
    """Resource could not be found (HTTP 404 / ``NOT_FOUND``)."""

    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, 404, "NOT_FOUND")


class UnauthorizedError(AppError):
    """Missing or invalid authentication credential (HTTP 401 / ``UNAUTHORIZED``)."""

    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(message, 401, "UNAUTHORIZED")


class ValidationError(AppError):
    """Invalid input data (HTTP 400 / ``VALIDATION_ERROR``)."""

    def __init__(self, message: str = "Validation failed") -> None:
        super().__init__(message, 400, "VALIDATION_ERROR")


class ConflictError(AppError):
    """Conflict with existing data (HTTP 409 / ``CONFLICT``)."""

    def __init__(self, message: str = "Resource already exists") -> None:
        super().__init__(message, 409, "CONFLICT")


class ForbiddenError(AppError):
    """Action not permitted for the authenticated user (HTTP 403 / ``FORBIDDEN``)."""

    def __init__(self, message: str = "Access forbidden") -> None:
        super().__init__(message, 403, "FORBIDDEN")


class DownstreamError(AppError):
    """Downstream service returned an invalid or unexpected response (HTTP 502).

    Use this when the downstream **did** respond but the response could not be
    parsed or did not match the expected schema.  For connectivity / availability
    issues use :class:`UnavailableError` instead.
    """

    def __init__(
        self,
        message: str = "Invalid response from downstream service",
        status_code: int = 502,
        code: str = "DOWNSTREAM_ERROR",
    ) -> None:
        super().__init__(message, status_code, code)


class UnavailableError(AppError):
    """Downstream service is currently unavailable (HTTP 503 / ``SERVICE_UNAVAILABLE``).

    Use for network failures, timeouts, or upstream 5xx responses.
    """

    def __init__(self, message: str = "Service unavailable") -> None:
        super().__init__(message, 503, "SERVICE_UNAVAILABLE")


class RateLimitError(AppError):
    """Caller has exceeded its request rate limit (HTTP 429 / ``RATE_LIMIT_EXCEEDED``)."""

    def __init__(self, message: str = "Rate limit exceeded") -> None:
        super().__init__(message, 429, "RATE_LIMIT_EXCEEDED")


def is_app_error(err: object) -> bool:
    """Return ``True`` if *err* is an :class:`AppError` instance.

    Args:
        err: Any object to test.

    Returns:
        ``True`` when *err* is an :class:`AppError` (or subclass), ``False``
        otherwise.

    Example:
        >>> from toolbox.errors import NotFoundError, is_app_error
        >>> is_app_error(NotFoundError())
        True
        >>> is_app_error(ValueError("oops"))
        False
    """
    return isinstance(err, AppError)
