"""Toolbox — shared utilities library for Elastic Resume Base Python services.

Toolbox provides lightweight helpers for structured logging and configuration
loading that follow the same conventions as the TypeScript Toolbox library.

Quick start::

    from toolbox import get_logger

    logger = get_logger(__name__)
    logger.info("Service started", extra={"port": 8001})
"""

from toolbox.logger import get_logger, setup_logging

__all__ = [
    "get_logger",
    "setup_logging",
]
