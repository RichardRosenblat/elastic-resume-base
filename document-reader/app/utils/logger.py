import logging
import sys


def configure_logging(log_level: str = "INFO") -> None:
    """Configure root logger with structured formatting.

    Args:
        log_level: Logging level string (e.g. "INFO", "DEBUG").
    """
    level = getattr(logging, log_level.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    fmt = (
        '{"time": "%(asctime)s", "level": "%(levelname)s",'
        ' "logger": "%(name)s", "message": "%(message)s"}'
    )
    formatter = logging.Formatter(fmt=fmt, datefmt="%Y-%m-%dT%H:%M:%S")
    handler.setFormatter(formatter)
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(handler)
