"""Structured logging helpers for Elastic Resume Base Python services.

Provides a lightweight ``get_logger`` factory that returns standard
:class:`logging.Logger` instances configured to emit JSON-structured output
when ``LOG_FORMAT=json`` is set — matching the Pino-based logging used by the
Node.js services.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any


class _JsonFormatter(logging.Formatter):
    """Log formatter that emits one JSON object per line.

    Output shape matches the Pino JSON format used by the TypeScript services
    so that all log lines across the stack share a common structure.
    """

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        payload: dict[str, Any] = {
            "level": record.levelname.lower(),
            "time": datetime.now(tz=timezone.utc).isoformat(),
            "name": record.name,
            "msg": record.getMessage(),
        }

        # Merge any ``extra`` fields passed by the caller.
        for key, value in vars(record).items():
            if key not in {
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
                "message",
                "taskName",
            }:
                payload[key] = value

        if record.exc_info:
            payload["err"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)


def setup_logging(level: str | None = None, *, json_format: bool | None = None) -> None:
    """Configure the root logger for the current process.

    Call this **once** at application startup before any loggers are used.  If
    it is never called, Python's default logging configuration is used (plain
    text to ``stderr``).

    Args:
        level: Log level string (e.g. ``"info"``, ``"debug"``, ``"warning"``).
            Defaults to the value of the ``LOG_LEVEL`` environment variable,
            falling back to ``"info"``.
        json_format: When ``True``, emit JSON-structured log lines.  When
            ``False``, emit human-readable text.  When ``None`` (default),
            reads the ``LOG_FORMAT`` environment variable — ``"json"`` enables
            JSON formatting, anything else uses text.

    Example:
        >>> from toolbox import setup_logging
        >>> setup_logging(level="debug", json_format=False)
    """
    resolved_level = (level or os.environ.get("LOG_LEVEL", "info")).upper()
    use_json = (
        json_format
        if json_format is not None
        else os.environ.get("LOG_FORMAT", "text").lower() == "json"
    )

    handler = logging.StreamHandler(sys.stdout)
    if use_json:
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )

    root = logging.getLogger()
    root.setLevel(resolved_level)

    # Replace any existing handlers so that setup_logging is idempotent.
    root.handlers.clear()
    root.addHandler(handler)


def get_logger(name: str) -> logging.Logger:
    """Return a :class:`logging.Logger` for the given module name.

    This is a thin wrapper around :func:`logging.getLogger` that follows the
    same naming convention as the TypeScript ``createLogger`` helper in the
    Toolbox library.

    Args:
        name: Logger name — pass ``__name__`` to use the calling module's name.

    Returns:
        A standard :class:`logging.Logger` instance.

    Example:
        >>> from toolbox import get_logger
        >>> logger = get_logger(__name__)
        >>> logger.info("Resume ingested", extra={"resumeId": "r-abc123"})
    """
    return logging.getLogger(name)
