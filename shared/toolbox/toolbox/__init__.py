"""elastic-resume-base-toolbox — Shared error hierarchy and cross-cutting utilities.

Mirrors the TypeScript Toolbox library so that Python services share the
same domain error vocabulary and HTTP middleware behaviour.

Quick start::

    from toolbox.errors import NotFoundError, ValidationError, is_app_error
    from toolbox.middleware import CorrelationIdMiddleware, get_correlation_id

    raise NotFoundError("Resume abc123 not found")
"""

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
from toolbox.middleware.correlation_id import (
    CORRELATION_ID_HEADER,
    CorrelationIdMiddleware,
    get_correlation_id,
)
from toolbox.middleware.request_logger import RequestLoggerMiddleware

__all__ = [
    # Error classes
    "AppError",
    "NotFoundError",
    "UnauthorizedError",
    "ValidationError",
    "ConflictError",
    "ForbiddenError",
    "DownstreamError",
    "UnavailableError",
    "RateLimitError",
    "is_app_error",
    # Middleware
    "CORRELATION_ID_HEADER",
    "CorrelationIdMiddleware",
    "RequestLoggerMiddleware",
    "get_correlation_id",
]
