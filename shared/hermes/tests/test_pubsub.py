"""Unit tests for the Hermes Pub/Sub singleton management."""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch

from hermes.pubsub import (
    _reset_pubsub_for_testing,
    get_pubsub_service,
    initialize_pubsub,
    initialize_pubsub_from_env,
)
from hermes.pubsub_options import PubSubOptions


@pytest.fixture(autouse=True)
def reset_pubsub() -> None:
    _reset_pubsub_for_testing()
    yield
    _reset_pubsub_for_testing()


class TestInitializePubSub:
    """Tests for initialize_pubsub()."""

    def test_creates_pubsub_service(self) -> None:
        with patch("hermes.services.pubsub_publishing_service.pubsub_v1") as mock:
            mock.PublisherClient.return_value = MagicMock()
            initialize_pubsub(PubSubOptions(project_id="demo"))
        assert get_pubsub_service() is not None

    def test_is_idempotent(self) -> None:
        with patch("hermes.services.pubsub_publishing_service.pubsub_v1") as mock:
            mock.PublisherClient.return_value = MagicMock()
            initialize_pubsub(PubSubOptions(project_id="demo"))
            svc1 = get_pubsub_service()
            initialize_pubsub(PubSubOptions(project_id="other"))
            svc2 = get_pubsub_service()
        assert svc1 is svc2


class TestInitializePubSubFromEnv:
    """Tests for initialize_pubsub_from_env()."""

    def test_reads_project_id_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PUBSUB_PROJECT_ID", "env-project")
        with patch("hermes.services.pubsub_publishing_service.pubsub_v1") as mock:
            mock.PublisherClient.return_value = MagicMock()
            initialize_pubsub_from_env()
        svc = get_pubsub_service()
        assert svc is not None

    def test_raises_when_project_id_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PUBSUB_PROJECT_ID", raising=False)
        with pytest.raises(Exception):
            initialize_pubsub_from_env()


class TestGetPubSubService:
    """Tests for get_pubsub_service()."""

    def test_raises_when_not_initialised(self) -> None:
        with pytest.raises(RuntimeError, match="not been initialised"):
            get_pubsub_service()
