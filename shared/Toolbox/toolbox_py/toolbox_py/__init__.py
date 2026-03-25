"""Toolbox — cross-cutting utilities for Elastic Resume Base Python services.

Mirrors the TypeScript ``@elastic-resume-base/toolbox`` package so that all
Python services share the same logging format and error vocabulary as the
Node.js services.

Quick start::

    from toolbox import setup_logging, get_logger

    setup_logging(level="INFO")
    logger = get_logger(__name__)
    logger.info("Service started")

Error classes::

    from toolbox import NotFoundError, ValidationError

    raise NotFoundError("Resume abc-123 not found")
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
from toolbox.logger import get_logger, setup_logging

__all__ = [
    # Logging
    "setup_logging",
    "get_logger",
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
]
