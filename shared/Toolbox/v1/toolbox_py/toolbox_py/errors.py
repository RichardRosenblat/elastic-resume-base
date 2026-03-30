"""Standard HTTP error classes for Elastic Resume Base Python services.

These mirror the TypeScript error classes in ``shared/Toolbox/src/errors.ts``
so that all services — regardless of implementation language — share the same
error codes and HTTP status codes.

Usage example::

    from toolbox import NotFoundError, ValidationError, is_app_error

    def get_user(uid: str) -> dict:
        user = db.get(uid)
        if user is None:
            raise NotFoundError(f"User {uid!r} not found")
        return user

    try:
        get_user("missing-uid")
    except Exception as exc:
        if is_app_error(exc):
            # exc.status_code and exc.code are available
            return {"error": {"code": exc.code, "message": exc.message}}, exc.status_code
        raise
"""

from __future__ import annotations


class AppError(Exception):
    """Base class for all application-level HTTP errors.

    Subclass and set :attr:`status_code` and :attr:`code` as class variables,
    then pass a human-readable ``message`` to the constructor.

    Attributes:
        message: Human-readable description of the error.
        status_code: HTTP status code to return to the client.
        code: Machine-readable error code string (e.g. ``"NOT_FOUND"``).
    """

    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message

    def __repr__(self) -> str:
        return (
            f"{type(self).__name__}("
            f"message={self.message!r}, "
            f"code={self.code!r}, "
            f"status_code={self.status_code})"
        )


class NotFoundError(AppError):
    """Raised when a requested resource cannot be found (HTTP 404)."""

    status_code = 404
    code = "NOT_FOUND"

    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message)


class UnauthorizedError(AppError):
    """Raised when authentication credentials are missing or invalid (HTTP 401)."""

    status_code = 401
    code = "UNAUTHORIZED"

    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(message)


class ValidationError(AppError):
    """Raised when request input fails validation (HTTP 400)."""

    status_code = 400
    code = "VALIDATION_ERROR"

    def __init__(self, message: str = "Validation failed") -> None:
        super().__init__(message)


class ConflictError(AppError):
    """Raised when a resource already exists or state is conflicting (HTTP 409)."""

    status_code = 409
    code = "CONFLICT"

    def __init__(self, message: str = "Resource already exists") -> None:
        super().__init__(message)


class ForbiddenError(AppError):
    """Raised when the authenticated user lacks permission (HTTP 403)."""

    status_code = 403
    code = "FORBIDDEN"

    def __init__(self, message: str = "Access forbidden") -> None:
        super().__init__(message)


class DownstreamError(AppError):
    """Raised when a downstream service returned an unexpected response (HTTP 502).

    Use this when the downstream *did* respond but the response could not be
    parsed or did not match the expected schema.  For connectivity/availability
    issues use :class:`UnavailableError` instead.
    """

    status_code = 502
    code = "DOWNSTREAM_ERROR"

    def __init__(self, message: str = "Invalid response from downstream service") -> None:
        super().__init__(message)


class UnavailableError(AppError):
    """Raised when the service or a dependency is temporarily unavailable (HTTP 503)."""

    status_code = 503
    code = "SERVICE_UNAVAILABLE"

    def __init__(self, message: str = "Service unavailable") -> None:
        super().__init__(message)


class RateLimitError(AppError):
    """Raised when the caller has exceeded the request rate limit (HTTP 429)."""

    status_code = 429
    code = "RATE_LIMIT_EXCEEDED"

    def __init__(
        self, message: str = "Too many requests. Please wait a moment and try again."
    ) -> None:
        super().__init__(message)


def is_app_error(exc: BaseException) -> bool:
    """Return ``True`` if *exc* is an :class:`AppError` instance.

    Args:
        exc: Any exception.

    Returns:
        ``True`` if *exc* is an :class:`AppError` (or any subclass).

    Example::

        from toolbox import is_app_error

        try:
            risky_operation()
        except Exception as exc:
            if is_app_error(exc):
                return error_response(exc.code, exc.message, exc.status_code)
            raise
    """
    return isinstance(exc, AppError)
