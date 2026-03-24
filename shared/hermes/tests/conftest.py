"""Shared pytest fixtures for Hermes unit tests."""

import pytest

from hermes import _reset_messaging_for_testing, _reset_pubsub_for_testing


@pytest.fixture(autouse=True)
def reset_messaging_singleton() -> None:
    """Reset the Hermes singletons before and after every test.

    This ensures that calls to ``initialize_messaging*`` or ``initialize_pubsub*``
    in one test do not bleed into subsequent tests.
    """
    _reset_messaging_for_testing()
    _reset_pubsub_for_testing()
    yield
    _reset_messaging_for_testing()
    _reset_pubsub_for_testing()
