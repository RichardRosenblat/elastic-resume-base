"""Unit tests for the Toolbox logging utilities."""

from __future__ import annotations

import json
import logging
import sys
from io import StringIO
from unittest.mock import patch

import pytest

from toolbox import get_logger, setup_logging


@pytest.fixture(autouse=True)
def reset_root_logger() -> None:
    """Reset the root logger to a clean state before and after every test."""
    root = logging.getLogger()
    original_handlers = root.handlers[:]
    original_level = root.level
    yield
    root.handlers = original_handlers
    root.level = original_level


class TestSetupLogging:
    """Tests for setup_logging()."""

    def test_sets_log_level_info_by_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Default log level is INFO when LOG_LEVEL is not set."""
        monkeypatch.delenv("LOG_LEVEL", raising=False)
        setup_logging()
        assert logging.getLogger().level == logging.INFO

    def test_sets_log_level_from_argument(self) -> None:
        """Explicit level argument overrides the env var."""
        setup_logging(level="debug")
        assert logging.getLogger().level == logging.DEBUG

    def test_sets_log_level_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """LOG_LEVEL env var sets the root logger level."""
        monkeypatch.setenv("LOG_LEVEL", "warning")
        setup_logging()
        assert logging.getLogger().level == logging.WARNING

    def test_text_format_by_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Text format is used when LOG_FORMAT is not set."""
        monkeypatch.delenv("LOG_FORMAT", raising=False)
        setup_logging()
        root = logging.getLogger()
        assert root.handlers
        assert not isinstance(root.handlers[0].formatter, logging.Formatter.__class__)

    def test_json_format_when_log_format_json(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """JSON formatter is used when LOG_FORMAT=json."""
        monkeypatch.setenv("LOG_FORMAT", "json")
        setup_logging()
        from toolbox.logger import _JsonFormatter

        root = logging.getLogger()
        assert root.handlers
        assert isinstance(root.handlers[0].formatter, _JsonFormatter)

    def test_json_format_when_json_format_true(self) -> None:
        """JSON formatter is used when json_format=True."""
        from toolbox.logger import _JsonFormatter

        setup_logging(json_format=True)
        root = logging.getLogger()
        assert isinstance(root.handlers[0].formatter, _JsonFormatter)

    def test_replaces_existing_handlers(self) -> None:
        """Calling setup_logging twice results in exactly one handler."""
        setup_logging()
        setup_logging()
        assert len(logging.getLogger().handlers) == 1

    def test_json_output_contains_level_and_msg(self) -> None:
        """JSON-formatted log lines contain level, msg, and name fields."""
        buf = StringIO()
        setup_logging(level="debug", json_format=True)
        root = logging.getLogger()
        root.handlers[0].stream = buf

        logger = get_logger("test.json.output")
        logger.info("hello json")

        line = buf.getvalue().strip()
        data = json.loads(line)
        assert data["level"] == "info"
        assert data["msg"] == "hello json"
        assert data["name"] == "test.json.output"

    def test_json_output_contains_extra_fields(self) -> None:
        """Extra fields passed to logger.info are included in JSON output."""
        buf = StringIO()
        setup_logging(level="debug", json_format=True)
        root = logging.getLogger()
        root.handlers[0].stream = buf

        logger = get_logger("test.extra")
        logger.info("resume ingested", extra={"resumeId": "r-abc"})

        data = json.loads(buf.getvalue().strip())
        assert data.get("resumeId") == "r-abc"


class TestGetLogger:
    """Tests for get_logger()."""

    def test_returns_logger_with_given_name(self) -> None:
        """The returned logger uses the provided name."""
        logger = get_logger("myapp.module")
        assert logger.name == "myapp.module"

    def test_returns_logging_logger_instance(self) -> None:
        """Returns a standard logging.Logger instance."""
        logger = get_logger("some.module")
        assert isinstance(logger, logging.Logger)

    def test_same_instance_for_same_name(self) -> None:
        """Repeated calls with the same name return the same Logger object."""
        assert get_logger("foo.bar") is get_logger("foo.bar")

    def test_different_instances_for_different_names(self) -> None:
        """Different names return different Logger objects."""
        assert get_logger("foo") is not get_logger("bar")
