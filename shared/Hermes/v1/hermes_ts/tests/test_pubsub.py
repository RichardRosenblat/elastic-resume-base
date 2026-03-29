"""Tests for the Hermes Pub/Sub initialisation layer."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from hermes_py import (
    _reset_pubsub_for_testing,
    get_publisher,
    initialize_pubsub,
    initialize_pubsub_from_env,
)
from hermes_py.interfaces.publisher import IPublisher


@pytest.fixture(autouse=True)
def reset_pubsub() -> None:
    """Ensure the Pub/Sub singleton is cleared before and after every test."""
    _reset_pubsub_for_testing()
    yield
    _reset_pubsub_for_testing()


class TestInitializePubSub:
    """Tests for :func:`~hermes_py.initialize_pubsub`."""

    def test_initialises_publisher(self) -> None:
        """``get_publisher`` succeeds after ``initialize_pubsub``."""
        with patch(
            "hermes_py.pubsub.PubSubPublisher",
        ) as mock_cls:
            initialize_pubsub("test-project")
        mock_cls.assert_called_once_with(project_id="test-project")
        assert get_publisher() is mock_cls.return_value

    def test_idempotent(self) -> None:
        """Calling ``initialize_pubsub`` twice keeps the first publisher."""
        with patch("hermes_py.pubsub.PubSubPublisher") as mock_cls:
            initialize_pubsub("project-a")
            initialize_pubsub("project-b")
        mock_cls.assert_called_once_with(project_id="project-a")


class TestInitializePubSubFromEnv:
    """Tests for :func:`~hermes_py.initialize_pubsub_from_env`."""

    def test_reads_gcp_project_id(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Publisher is initialised using the ``GCP_PROJECT_ID`` env var."""
        monkeypatch.setenv("GCP_PROJECT_ID", "env-project")
        with patch("hermes_py.pubsub.PubSubPublisher") as mock_cls:
            initialize_pubsub_from_env()
        mock_cls.assert_called_once_with(project_id="env-project")

    def test_raises_when_env_var_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """``ValidationError`` is raised when ``GCP_PROJECT_ID`` is not set."""
        monkeypatch.delenv("GCP_PROJECT_ID", raising=False)
        with pytest.raises(Exception):
            initialize_pubsub_from_env()

    def test_idempotent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Calling ``initialize_pubsub_from_env`` twice keeps the first publisher."""
        monkeypatch.setenv("GCP_PROJECT_ID", "env-project")
        with patch("hermes_py.pubsub.PubSubPublisher") as mock_cls:
            initialize_pubsub_from_env()
            initialize_pubsub_from_env()
        mock_cls.assert_called_once()


class TestGetPublisher:
    """Tests for :func:`~hermes_py.get_publisher`."""

    def test_raises_before_initialisation(self) -> None:
        """``RuntimeError`` is raised when the singleton has not been initialised."""
        with pytest.raises(RuntimeError, match="Hermes Pub/Sub has not been initialised"):
            get_publisher()

    def test_returns_publisher_after_init(self) -> None:
        """``get_publisher`` returns the initialised publisher."""
        mock_publisher = MagicMock(spec=IPublisher)
        with patch("hermes_py.pubsub.PubSubPublisher", return_value=mock_publisher):
            initialize_pubsub("my-project")
        assert get_publisher() is mock_publisher


class TestResetPubSubForTesting:
    """Tests for :func:`~hermes_py._reset_pubsub_for_testing`."""

    def test_clears_singleton(self) -> None:
        """``_reset_pubsub_for_testing`` makes ``get_publisher`` raise again."""
        with patch("hermes_py.pubsub.PubSubPublisher"):
            initialize_pubsub("my-project")
        _reset_pubsub_for_testing()
        with pytest.raises(RuntimeError):
            get_publisher()
