"""Toolbox — shared utilities library for Elastic Resume Base Python services.

Toolbox provides lightweight helpers for structured logging, correlation-ID
middleware, and configuration loading that follow the same conventions as the
TypeScript Toolbox library.

Quick start::

    from toolbox import get_logger, CorrelationIdMiddleware, load_config_yaml

    # Load config.yaml before settings are resolved.
    load_config_yaml("ingestor-service")

    logger = get_logger(__name__)
    logger.info("Service started", extra={"port": 8001})

    # Add correlation-ID middleware to your FastAPI app.
    app.add_middleware(CorrelationIdMiddleware)
"""

from toolbox.config_yaml import load_config_yaml
from toolbox.logger import get_logger, setup_logging
from toolbox.middleware import CORRELATION_ID_HEADER, CorrelationIdMiddleware

__all__ = [
    "get_logger",
    "setup_logging",
    "CorrelationIdMiddleware",
    "CORRELATION_ID_HEADER",
    "load_config_yaml",
]
