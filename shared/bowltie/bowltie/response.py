"""Standard API response envelope types and factory helpers.

Mirrors ``shared/Bowltie/src/response.ts`` so Python and TypeScript services
produce the same JSON envelope structure.

Shapes
------
Success::

    {
      "success": true,
      "data": <payload>,
      "meta": { "timestamp": "...", "correlationId": "..." }
    }

Error::

    {
      "success": false,
      "error": { "code": "NOT_FOUND", "message": "Resume not found" },
      "meta": { "timestamp": "...", "correlationId": "..." }
    }
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ResponseMeta(BaseModel):
    """Metadata attached to every API response envelope.

    Attributes:
        timestamp: ISO-8601 UTC timestamp of when the response was generated.
        correlation_id: Optional trace ID for distributed request correlation.
    """

    timestamp: str
    correlation_id: str | None = Field(default=None, alias="correlationId")

    model_config = {"populate_by_name": True}


class SuccessResponse(BaseModel, Generic[T]):
    """Standard success response envelope.

    Attributes:
        success: Always ``True`` — discriminates from :class:`ErrorResponse`.
        data: The response payload.
        meta: Timestamp and optional correlation ID.

    Example:
        >>> resp = format_success({"resumeId": "abc"}, correlation_id="req-1")
        >>> resp.success
        True
        >>> resp.data["resumeId"]
        'abc'
    """

    success: bool = True
    data: T
    meta: ResponseMeta


class ErrorResponse(BaseModel):
    """Standard error response envelope.

    Attributes:
        success: Always ``False``.
        error: Machine-readable code and human-readable message.
        meta: Timestamp and optional correlation ID.

    Example:
        >>> resp = format_error("NOT_FOUND", "Resume not found")
        >>> resp.success
        False
        >>> resp.error["code"]
        'NOT_FOUND'
    """

    success: bool = False
    error: dict[str, str]
    meta: ResponseMeta


#: Union type for any API response.
ApiResponse = SuccessResponse[Any] | ErrorResponse


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def format_success(data: T, correlation_id: str | None = None) -> SuccessResponse[T]:
    """Build a standard success response envelope.

    Args:
        data: The response payload to wrap.
        correlation_id: Optional correlation/trace ID to include in ``meta``.

    Returns:
        A :class:`SuccessResponse` ready to be returned from a FastAPI route.

    Example:
        >>> from bowltie.response import format_success
        >>> resp = format_success({"status": "ok"}, correlation_id="abc")
        >>> resp.success
        True
    """
    return SuccessResponse(
        success=True,
        data=data,
        meta=ResponseMeta(timestamp=_now_iso(), correlationId=correlation_id),
    )


def format_error(
    code: str,
    message: str,
    correlation_id: str | None = None,
) -> ErrorResponse:
    """Build a standard error response envelope.

    Args:
        code: Machine-readable uppercase error code (e.g. ``"NOT_FOUND"``).
        message: Human-readable description of the error.
        correlation_id: Optional correlation/trace ID to include in ``meta``.

    Returns:
        An :class:`ErrorResponse` ready to be returned from a FastAPI route.

    Example:
        >>> from bowltie.response import format_error
        >>> resp = format_error("NOT_FOUND", "Resume not found", "abc")
        >>> resp.success
        False
        >>> resp.error["code"]
        'NOT_FOUND'
    """
    return ErrorResponse(
        success=False,
        error={"code": code, "message": message},
        meta=ResponseMeta(timestamp=_now_iso(), correlationId=correlation_id),
    )
