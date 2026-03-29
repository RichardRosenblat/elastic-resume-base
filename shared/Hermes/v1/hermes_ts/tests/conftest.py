"""Shared pytest fixtures for Hermes unit tests."""

import pytest

from hermes_py import _reset_messaging_for_testing


@pytest.fixture(autouse=True)
def reset_messaging_singleton() -> None:
    """Reset the Hermes singleton before and after every test.

    This ensures that calls to ``initialize_messaging*`` in one test do not
    bleed into subsequent tests.
    """
    _reset_messaging_for_testing()
    yield
    _reset_messaging_for_testing()
