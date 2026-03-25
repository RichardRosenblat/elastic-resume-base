"""Shared pytest fixtures for Toolbox unit tests."""

import logging

import pytest


@pytest.fixture(autouse=True)
def reset_root_logger() -> None:
    """Reset the root logger before and after every test.

    setup_logging() is idempotent (it only adds a handler once), but we need
    to clean up between tests so handler state doesn't bleed across tests.
    """
    root = logging.getLogger()
    original_handlers = root.handlers[:]
    original_level = root.level
    yield
    root.handlers = original_handlers
    root.setLevel(original_level)
