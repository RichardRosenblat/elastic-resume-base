"""Unit tests for the Hermes event-publishing initialisation module."""

from __future__ import annotations

import pytest

from hermes import (
    _reset_pubsub_for_testing,
    get_event_publisher,
    initialize_pubsub,
    initialize_pubsub_from_env,
)
from hermes.services.pubsub_event_publisher import PubSubEventPublisher


# ---------------------------------------------------------------------------
# initialize_pubsub
# ---------------------------------------------------------------------------


class TestInitializePubsub:
    """Tests for initialize_pubsub()."""

    def test_creates_pubsub_event_publisher(self) -> None:
        """After initialization, get_event_publisher returns a PubSubEventPublisher."""
        initialize_pubsub("my-project")
        publisher = get_event_publisher()
        assert isinstance(publisher, PubSubEventPublisher)

    def test_project_id_forwarded_to_publisher(self) -> None:
        """The project_id is passed through to the PubSubEventPublisher."""
        initialize_pubsub("test-project-123")
        publisher = get_event_publisher()
        assert isinstance(publisher, PubSubEventPublisher)
        assert publisher._project_id == "test-project-123"

    def test_is_idempotent(self) -> None:
        """A second call to initialize_pubsub has no effect — first call wins."""
        initialize_pubsub("first-project")
        first_instance = get_event_publisher()

        initialize_pubsub("second-project")
        second_instance = get_event_publisher()

        assert first_instance is second_instance

    def test_idempotent_preserves_project_id(self) -> None:
        """A second call does not change the project_id of the first publisher."""
        initialize_pubsub("original-project")
        publisher = get_event_publisher()
        assert isinstance(publisher, PubSubEventPublisher)
        assert publisher._project_id == "original-project"

        initialize_pubsub("different-project")
        assert publisher._project_id == "original-project"


# ---------------------------------------------------------------------------
# initialize_pubsub_from_env
# ---------------------------------------------------------------------------


class TestInitializePubsubFromEnv:
    """Tests for initialize_pubsub_from_env()."""

    def test_reads_gcp_project_id_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """GCP_PROJECT_ID env var is read and forwarded to the publisher."""
        monkeypatch.setenv("GCP_PROJECT_ID", "env-project-abc")
        initialize_pubsub_from_env()
        publisher = get_event_publisher()
        assert isinstance(publisher, PubSubEventPublisher)
        assert publisher._project_id == "env-project-abc"

    def test_is_idempotent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """A second call has no effect — the first publisher instance is preserved."""
        monkeypatch.setenv("GCP_PROJECT_ID", "proj-1")
        initialize_pubsub_from_env()
        first_instance = get_event_publisher()

        monkeypatch.setenv("GCP_PROJECT_ID", "proj-2")
        initialize_pubsub_from_env()
        second_instance = get_event_publisher()

        assert first_instance is second_instance

    def test_raises_when_gcp_project_id_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """ValidationError is raised when GCP_PROJECT_ID is absent."""
        monkeypatch.delenv("GCP_PROJECT_ID", raising=False)
        with pytest.raises(Exception):
            initialize_pubsub_from_env()


# ---------------------------------------------------------------------------
# get_event_publisher
# ---------------------------------------------------------------------------


class TestGetEventPublisher:
    """Tests for get_event_publisher()."""

    def test_raises_before_initialisation(self) -> None:
        """RuntimeError is raised when called before any init function."""
        with pytest.raises(RuntimeError, match="initialize_pubsub"):
            get_event_publisher()

    def test_returns_same_singleton_on_repeated_calls(self) -> None:
        """Repeated calls to get_event_publisher return the same instance."""
        initialize_pubsub("proj")
        assert get_event_publisher() is get_event_publisher()
