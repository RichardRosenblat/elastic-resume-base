"""Unit tests for toolbox_py.logger module."""

from __future__ import annotations

import json
import logging
from io import StringIO

from toolbox_py import get_logger, setup_logging


class TestSetupLogging:
    """Tests for setup_logging()."""

    def test_sets_root_level_to_info_by_default(self) -> None:
        """setup_logging() without arguments sets the root level to INFO."""
        setup_logging()
        assert logging.getLogger().level == logging.INFO

    def test_sets_root_level_from_argument(self) -> None:
        """setup_logging(level='DEBUG') sets the root level to DEBUG."""
        setup_logging(level="DEBUG")
        assert logging.getLogger().level == logging.DEBUG

    def test_level_is_case_insensitive(self) -> None:
        """Level argument is accepted in any case."""
        setup_logging(level="warning")
        assert logging.getLogger().level == logging.WARNING

    def test_invalid_level_falls_back_to_info(self) -> None:
        """An unrecognised level string falls back to INFO."""
        setup_logging(level="NONSENSE")
        assert logging.getLogger().level == logging.INFO

    def test_idempotent_does_not_add_duplicate_handlers(self) -> None:
        """Calling setup_logging twice does not add a second handler."""
        root = logging.getLogger()
        root.handlers.clear()
        setup_logging()
        setup_logging()
        assert len(root.handlers) == 1

    def test_json_format_produces_json_output(self) -> None:
        """json_format=True (default) emits valid JSON log lines."""
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(
            logging.Formatter(
                fmt=(
                    '{"time": "%(asctime)s", "level": "%(levelname)s",'
                    ' "logger": "%(name)s", "message": "%(message)s"}'
                ),
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
        )
        root = logging.getLogger()
        root.handlers.clear()
        root.addHandler(handler)
        root.setLevel(logging.INFO)

        logger = get_logger("test.json")
        logger.info("hello world")

        output = stream.getvalue().strip()
        parsed = json.loads(output)
        assert parsed["message"] == "hello world"
        assert parsed["level"] == "INFO"
        assert parsed["logger"] == "test.json"


class TestGetLogger:
    """Tests for get_logger()."""

    def test_returns_logger_with_correct_name(self) -> None:
        """get_logger('my.module') returns a Logger named 'my.module'."""
        logger = get_logger("my.module")
        assert logger.name == "my.module"

    def test_returns_standard_logging_logger(self) -> None:
        """get_logger returns a stdlib logging.Logger instance."""
        logger = get_logger("some.service")
        assert isinstance(logger, logging.Logger)

    def test_same_name_returns_same_instance(self) -> None:
        """get_logger is idempotent — same name yields the same Logger object."""
        a = get_logger("shared.logger")
        b = get_logger("shared.logger")
        assert a is b
