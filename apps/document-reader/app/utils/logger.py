"""Logger module — re-exports the shared Toolbox logger for backwards compatibility.

New code in this service should import directly from ``toolbox``::

    from toolbox_py import get_logger, setup_logging

This module is kept so that any internal references to
``app.utils.logger.configure_logging`` continue to work during the transition.
"""

from toolbox_py import get_logger, setup_logging


def configure_logging(log_level: str = "INFO") -> None:
    """Configure root logger using the shared Toolbox logger.

    Delegates to :func:`toolbox.setup_logging` with the given level.

    Args:
        log_level: Logging level string (e.g. "INFO", "DEBUG").
    """
    setup_logging(level=log_level)


__all__ = ["configure_logging", "setup_logging", "get_logger"]
