"""Standard API response envelope helpers for Elastic Resume Base Python services.

Bowltie ensures that every service returns the same JSON response shape,
making it easy for clients to handle both success and error cases uniformly.

Quick start::

    from bowltie import format_success, format_error

    # In a FastAPI route handler:
    return format_success({"resumeId": "resume-abc123"})
    # → {"success": True, "data": {"resumeId": "resume-abc123"}, "meta": {"timestamp": "..."}}

    return format_error("NOT_FOUND", "Resume not found")
    # → {"success": False, "error": {"code": "NOT_FOUND", "message": "..."}, "meta": {...}}
"""

from bowltie.response import (
    ApiResponse,
    ErrorResponse,
    ResponseMeta,
    SuccessResponse,
    format_error,
    format_success,
)

__all__ = [
    "ResponseMeta",
    "SuccessResponse",
    "ErrorResponse",
    "ApiResponse",
    "format_success",
    "format_error",
]
