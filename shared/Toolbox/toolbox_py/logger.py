"""Structured JSON logging utilities for Elastic Resume Base Python services.

The JSON format mirrors the Pino logging output used by the TypeScript services,
ensuring consistency across all service logs in Google Cloud Logging.

The ``setup_logging`` function replaces the Pino ``createLogger`` factory from
``@elastic-resume-base/toolbox`` for Python services — call it **once** at
application startup, then obtain per-module loggers with ``get_logger``.
"""

from __future__ import annotations

import logging
import sys


def setup_logging(level: str = "INFO", json_format: bool = True) -> None:
    """Initialise the root logger with structured formatting.

    Call **once** at application startup (e.g. in ``main.py``) before creating
    the FastAPI application.  Subsequent calls are idempotent — the handler is
    only added once.

    Args:
        level: Logging level string (``"DEBUG"``, ``"INFO"``, ``"WARNING"``,
            ``"ERROR"``, ``"CRITICAL"``).  Case-insensitive.  Defaults to
            ``"INFO"``.
        json_format: When ``True`` (default) emits Pino-compatible JSON lines
            suitable for Google Cloud Logging.  When ``False`` emits a
            human-readable format useful for local development.

    Example::

        from toolbox import setup_logging
        setup_logging(level="DEBUG", json_format=False)
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)

    if json_format:
        fmt = (
            '{"time": "%(asctime)s", "level": "%(levelname)s",'
            ' "logger": "%(name)s", "message": "%(message)s"}'
        )
        formatter = logging.Formatter(fmt=fmt, datefmt="%Y-%m-%dT%H:%M:%S")
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )

    handler.setFormatter(formatter)

    root = logging.getLogger()
    # Avoid duplicate handlers if setup_logging is called more than once.
    if not root.handlers:
        root.addHandler(handler)
    root.setLevel(numeric_level)


def get_logger(name: str) -> logging.Logger:
    """Return a :class:`logging.Logger` for the given module name.

    Equivalent to ``logging.getLogger(name)`` but keeps all logger creation
    in one place and makes it easy to swap out the underlying implementation
    in future.

    Args:
        name: Typically ``__name__`` of the calling module.

    Returns:
        A :class:`logging.Logger` instance configured by the root handler set
        up via :func:`setup_logging`.

    Example::

        from toolbox import get_logger

        logger = get_logger(__name__)
        logger.info("Processing started", extra={"resume_id": "abc-123"})
    """
    return logging.getLogger(name)
