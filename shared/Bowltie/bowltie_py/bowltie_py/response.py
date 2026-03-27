"""Standard API response formatting for Elastic Resume Base Python services.

Mirrors ``shared/Bowltie/src/response.ts`` so that every service — regardless
of the implementation language — returns identical JSON envelopes.

Envelope shapes
---------------

**Success**::

    {
        "success": true,
        "data": <payload>,
        "meta": {
            "correlationId": "<id>",   # only present when provided
            "timestamp": "2025-01-01T00:00:00.000Z"
        }
    }

**Error**::

    {
        "success": false,
        "error": {
            "code": "<code>",
            "message": "<message>"
        },
        "meta": {
            "correlationId": "<id>",   # only present when provided
            "timestamp": "2025-01-01T00:00:00.000Z"
        }
    }
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any


def _now_iso() -> str:
    """Return the current UTC time formatted as an ISO-8601 string.

    Matches the ``new Date().toISOString()`` format used in the TypeScript
    implementation (millisecond precision, ``Z`` suffix).
    """
    return (
        datetime.now(tz=UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def format_success(
    data: Any,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Wrap *data* in a standard success response envelope.

    Args:
        data: The payload to return to the client.  Must be JSON-serialisable.
        correlation_id: Optional request correlation identifier for distributed
            tracing.  When provided it is included in the ``meta`` object.

    Returns:
        A :class:`dict` matching the ``SuccessResponse<T>`` TypeScript type.

    Example::

        from bowltie import format_success
        from fastapi.responses import JSONResponse

        return JSONResponse(format_success({"uid": "abc-123", "name": "Alice"}))
    """
    meta: dict[str, Any] = {"timestamp": _now_iso()}
    if correlation_id is not None:
        meta["correlationId"] = correlation_id

    return {
        "success": True,
        "data": data,
        "meta": meta,
    }


def format_error(
    code: str,
    message: str,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Wrap an error in a standard error response envelope.

    Args:
        code: Machine-readable error code (e.g. ``"NOT_FOUND"``,
            ``"VALIDATION_ERROR"``).  Should match the codes in
            ``shared/Toolbox/src/errors.ts`` / ``shared/Toolbox/toolbox_py/errors.py``.
        message: Human-readable error description.
        correlation_id: Optional request correlation identifier for distributed
            tracing.  When provided it is included in the ``meta`` object.

    Returns:
        A :class:`dict` matching the ``ErrorResponse`` TypeScript type.

    Example::

        from bowltie import format_error
        from fastapi.responses import JSONResponse

        return JSONResponse(format_error("NOT_FOUND", "Resume not found"), status_code=404)
    """
    meta: dict[str, Any] = {"timestamp": _now_iso()}
    if correlation_id is not None:
        meta["correlationId"] = correlation_id

    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
        },
        "meta": meta,
    }
