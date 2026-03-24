"""elastic-resume-base-toolbox — Shared error hierarchy and cross-cutting utilities.

Mirrors the TypeScript Toolbox library so that Python services share the
same domain error vocabulary.

Quick start::

    from toolbox.errors import NotFoundError, ValidationError, is_app_error

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

__all__ = [
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
]
