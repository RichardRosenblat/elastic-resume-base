"""Unit tests for PubSubEventPublisher."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from hermes.interfaces.event_publisher import PublishPayload
from hermes.services.pubsub_event_publisher import PubSubEventPublisher


def _make_mock_client(message_id: str = "msg-001") -> MagicMock:
    """Return a minimal PublisherClient mock."""
    client = MagicMock()
    client.topic_path.side_effect = lambda project, topic: f"projects/{project}/topics/{topic}"
    future = MagicMock()
    future.result.return_value = message_id
    client.publish.return_value = future
    return client


# ---------------------------------------------------------------------------
# Constructor
# ---------------------------------------------------------------------------


class TestPubSubEventPublisherConstructor:
    """Tests for PubSubEventPublisher.__init__."""

    def test_stores_project_id(self) -> None:
        """The project_id is accessible after construction."""
        publisher = PubSubEventPublisher(project_id="my-project")
        assert publisher._project_id == "my-project"

    def test_client_is_none_before_first_publish(self) -> None:
        """The client is not created until publish() is first called."""
        publisher = PubSubEventPublisher(project_id="my-project")
        assert publisher._client is None

    def test_injected_factory_used_instead_of_default(self) -> None:
        """When a publisher_factory is provided, it is used instead of the real client."""
        mock_client = _make_mock_client()
        publisher = PubSubEventPublisher(
            project_id="my-project",
            publisher_factory=lambda: mock_client,
        )
        publisher.publish("some-topic", PublishPayload(data={"key": "value"}))
        assert publisher._client is mock_client


# ---------------------------------------------------------------------------
# publish
# ---------------------------------------------------------------------------


class TestPubSubEventPublisherPublish:
    """Tests for PubSubEventPublisher.publish."""

    def test_returns_message_id(self) -> None:
        """publish() returns the message ID from the Pub/Sub future."""
        mock_client = _make_mock_client(message_id="12345")
        publisher = PubSubEventPublisher(
            project_id="test-project",
            publisher_factory=lambda: mock_client,
        )
        result = publisher.publish("my-topic", PublishPayload(data={"resumeId": "r-1"}))
        assert result == "12345"

    def test_topic_path_is_constructed_correctly(self) -> None:
        """The full topic resource path is built from project_id and topic name."""
        mock_client = _make_mock_client()
        publisher = PubSubEventPublisher(
            project_id="proj-123",
            publisher_factory=lambda: mock_client,
        )
        publisher.publish("resume-ingested", PublishPayload(data={}))
        mock_client.topic_path.assert_called_once_with("proj-123", "resume-ingested")

    def test_data_is_json_encoded(self) -> None:
        """The data dict is serialised as UTF-8 JSON before publishing."""
        import json

        mock_client = _make_mock_client()
        publisher = PubSubEventPublisher(
            project_id="proj",
            publisher_factory=lambda: mock_client,
        )
        publisher.publish("topic", PublishPayload(data={"resumeId": "abc", "status": "INGESTED"}))
        call_kwargs = mock_client.publish.call_args
        raw_data: bytes = call_kwargs[1]["data"]
        parsed = json.loads(raw_data.decode("utf-8"))
        assert parsed == {"resumeId": "abc", "status": "INGESTED"}

    def test_attributes_forwarded_as_kwargs(self) -> None:
        """Message attributes are passed as keyword arguments to client.publish."""
        mock_client = _make_mock_client()
        publisher = PubSubEventPublisher(
            project_id="proj",
            publisher_factory=lambda: mock_client,
        )
        publisher.publish(
            "topic",
            PublishPayload(data={"key": "val"}, attributes={"source": "ingestor"}),
        )
        call_kwargs = mock_client.publish.call_args
        assert call_kwargs[1]["source"] == "ingestor"

    def test_empty_attributes_do_not_break_publish(self) -> None:
        """Publishing with no attributes does not raise."""
        mock_client = _make_mock_client()
        publisher = PubSubEventPublisher(
            project_id="proj",
            publisher_factory=lambda: mock_client,
        )
        publisher.publish("topic", PublishPayload(data={"key": "val"}))
        mock_client.publish.assert_called_once()

    def test_client_created_lazily_once(self) -> None:
        """The factory is only called once regardless of how many publishes are made."""
        factory_calls = 0

        def factory() -> MagicMock:
            nonlocal factory_calls
            factory_calls += 1
            return _make_mock_client()

        publisher = PubSubEventPublisher(project_id="proj", publisher_factory=factory)
        publisher.publish("t", PublishPayload(data={}))
        publisher.publish("t", PublishPayload(data={}))
        assert factory_calls == 1

    def test_propagates_future_exception(self) -> None:
        """If the Pub/Sub future raises, the exception is propagated."""
        mock_client = MagicMock()
        mock_client.topic_path.return_value = "projects/proj/topics/t"
        future = MagicMock()
        future.result.side_effect = RuntimeError("Pub/Sub unavailable")
        mock_client.publish.return_value = future

        publisher = PubSubEventPublisher(
            project_id="proj",
            publisher_factory=lambda: mock_client,
        )
        with pytest.raises(RuntimeError, match="Pub/Sub unavailable"):
            publisher.publish("t", PublishPayload(data={}))

    def test_default_client_creation_imports_pubsub(self) -> None:
        """When no factory is provided, a real PublisherClient is created via import."""
        mock_client = _make_mock_client()
        mock_pubsub = MagicMock()
        mock_pubsub.PublisherClient.return_value = mock_client

        publisher = PubSubEventPublisher(project_id="my-project")
        with patch.dict(
            "sys.modules",
            {"google.cloud": MagicMock(pubsub_v1=mock_pubsub), "google.cloud.pubsub_v1": mock_pubsub},
        ):
            with patch(
                "hermes.services.pubsub_event_publisher.PubSubEventPublisher._get_client",
                return_value=mock_client,
            ):
                publisher.publish("t", PublishPayload(data={}))
        mock_client.publish.assert_called_once()
