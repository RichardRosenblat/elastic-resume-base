"""Synapse error classes — thin re-exports from the Python Toolbox.

Synapse re-exports the canonical error hierarchy from ``elastic-resume-base-toolbox``
so that consuming services can import errors from a single location without
needing to know which library originally defined them.

This mirrors the TypeScript Synapse ``errors.ts`` module.
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
