"""Standard API response envelope types and formatting functions.

All API responses from Elastic Resume Base Python services must use these
types and helper functions to ensure a consistent response shape that matches
the TypeScript Bowltie library.

Response shape::

    # Success
    {
        "success": True,
        "data": <payload>,
        "meta": {
            "correlationId": "<optional>",
            "timestamp": "<ISO-8601>"
        }
    }

    # Error
    {
        "success": False,
        "error": {
            "code": "<machine-readable code>",
            "message": "<human-readable description>"
        },
        "meta": {
            "correlationId": "<optional>",
            "timestamp": "<ISO-8601>"
        }
    }
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Generic, TypeVar, Union

T = TypeVar("T")


@dataclass(frozen=True)
class ResponseMeta:
    """Metadata included in every API response.

    Attributes:
        timestamp: ISO-8601 UTC timestamp of when the response was generated.
        correlation_id: Optional correlation / request ID for distributed tracing.

    Example:
        >>> meta = ResponseMeta(timestamp="2026-01-15T10:30:00.000000+00:00")
    """

    timestamp: str
    correlation_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a plain dict suitable for JSON responses.

        The ``correlation_id`` key is omitted when the value is ``None`` to
        keep responses lean.
        """
        d: dict[str, Any] = {"timestamp": self.timestamp}
        if self.correlation_id is not None:
            d["correlationId"] = self.correlation_id
        return d


@dataclass(frozen=True)
class SuccessResponse(Generic[T]):
    """Standard success response envelope.

    Attributes:
        success: Always ``True``.
        data: The response payload.
        meta: Response metadata (timestamp, optional correlation ID).

    Example:
        >>> resp = SuccessResponse(
        ...     success=True,
        ...     data={"resumeId": "abc123"},
        ...     meta=ResponseMeta(timestamp="2026-01-15T10:30:00.000000+00:00"),
        ... )
    """

    success: bool
    data: T
    meta: ResponseMeta

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a plain dict suitable for JSON responses."""
        return {
            "success": self.success,
            "data": self.data,
            "meta": self.meta.to_dict(),
        }


@dataclass(frozen=True)
class ErrorDetail:
    """The error payload nested inside an :class:`ErrorResponse`.

    Attributes:
        code: Machine-readable error code (e.g. ``"NOT_FOUND"``).
        message: Human-readable error description.
    """

    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        """Serialise to a plain dict."""
        return {"code": self.code, "message": self.message}


@dataclass(frozen=True)
class ErrorResponse:
    """Standard error response envelope.

    Attributes:
        success: Always ``False``.
        error: Machine-readable code and human-readable message.
        meta: Response metadata (timestamp, optional correlation ID).

    Example:
        >>> resp = ErrorResponse(
        ...     success=False,
        ...     error=ErrorDetail(code="NOT_FOUND", message="Resume not found"),
        ...     meta=ResponseMeta(timestamp="2026-01-15T10:30:00.000000+00:00"),
        ... )
    """

    success: bool
    error: ErrorDetail
    meta: ResponseMeta

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a plain dict suitable for JSON responses."""
        return {
            "success": self.success,
            "error": self.error.to_dict(),
            "meta": self.meta.to_dict(),
        }


ApiResponse = Union[SuccessResponse[T], ErrorResponse]
"""Union type for any standard API response (success or error)."""


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(tz=timezone.utc).isoformat()


def format_success(data: T, correlation_id: str | None = None) -> SuccessResponse[T]:
    """Build a standard success response envelope.

    Args:
        data: The payload to include in the response.
        correlation_id: Optional correlation/request ID for distributed tracing.

    Returns:
        A :class:`SuccessResponse` ready to be serialised and returned to the client.

    Example:
        >>> from bowltie import format_success
        >>> resp = format_success({"resumeId": "abc123"}, correlation_id="req-001")
        >>> resp.to_dict()
        {'success': True, 'data': {'resumeId': 'abc123'}, 'meta': {'timestamp': ..., 'correlationId': 'req-001'}}
    """
    return SuccessResponse(
        success=True,
        data=data,
        meta=ResponseMeta(timestamp=_now_iso(), correlation_id=correlation_id),
    )


def format_error(
    code: str,
    message: str,
    correlation_id: str | None = None,
) -> ErrorResponse:
    """Build a standard error response envelope.

    Args:
        code: Machine-readable error code (e.g. ``"NOT_FOUND"``, ``"VALIDATION_ERROR"``).
        message: Human-readable error description.
        correlation_id: Optional correlation/request ID for distributed tracing.

    Returns:
        An :class:`ErrorResponse` ready to be serialised and returned to the client.

    Example:
        >>> from bowltie import format_error
        >>> resp = format_error("NOT_FOUND", "Resume not found", correlation_id="req-001")
        >>> resp.to_dict()
        {'success': False, 'error': {'code': 'NOT_FOUND', 'message': 'Resume not found'}, 'meta': {...}}
    """
    return ErrorResponse(
        success=False,
        error=ErrorDetail(code=code, message=message),
        meta=ResponseMeta(timestamp=_now_iso(), correlation_id=correlation_id),
    )
