"""elastic-resume-base-bowltie — Standard API response envelopes for Python services.

Mirrors the TypeScript Bowltie library so that all microservices return the
same JSON shape regardless of language.

Quick start::

    from bowltie import format_success, format_error

    return format_success({"resumeId": "abc"}, correlation_id="req-001")
    return format_error("NOT_FOUND", "Resume not found", correlation_id="req-001")
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
