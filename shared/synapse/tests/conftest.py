"""Shared fixtures for Synapse unit tests."""

from __future__ import annotations

import pytest

from synapse.persistence import _reset_persistence_for_testing


@pytest.fixture(autouse=True)
def reset_synapse_singleton() -> None:
    """Reset the Firestore singleton before and after every test."""
    _reset_persistence_for_testing()
    yield
    _reset_persistence_for_testing()
