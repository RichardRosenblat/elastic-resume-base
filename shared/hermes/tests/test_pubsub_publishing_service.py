"""Unit tests for PubSubPublishingService."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from hermes.pubsub_options import PubSubOptions
from hermes.services.pubsub_publishing_service import PubSubPublishError, PubSubPublishingService


def _make_service(project_id: str = "demo") -> PubSubPublishingService:
    with patch("hermes.services.pubsub_publishing_service.pubsub_v1") as mock_pubsub:
        mock_pubsub.PublisherClient.return_value = MagicMock()
        return PubSubPublishingService(PubSubOptions(project_id=project_id))


class TestPubSubPublishingServicePublish:
    """Tests for PubSubPublishingService.publish()."""

    @pytest.mark.asyncio
    async def test_publishes_json_encoded_payload(self) -> None:
        with patch("hermes.services.pubsub_publishing_service.pubsub_v1") as mock_pubsub:
            mock_publisher = MagicMock()
            mock_future = MagicMock()
            mock_future.result.return_value = "msg-id-001"
            mock_publisher.publish.return_value = mock_future
            mock_publisher.topic_path.return_value = "projects/demo/topics/resume_indexing"
            mock_pubsub.PublisherClient.return_value = mock_publisher

            svc = PubSubPublishingService(PubSubOptions(project_id="demo"))
            msg_id = await svc.publish("resume_indexing", {"resumeId": "abc123"})

        assert msg_id == "msg-id-001"
        data = mock_publisher.publish.call_args[0][1]
        assert b"abc123" in data

    @pytest.mark.asyncio
    async def test_raises_publish_error_on_failure(self) -> None:
        with patch("hermes.services.pubsub_publishing_service.pubsub_v1") as mock_pubsub:
            mock_publisher = MagicMock()
            mock_future = MagicMock()
            mock_future.result.side_effect = RuntimeError("unavailable")
            mock_publisher.publish.return_value = mock_future
            mock_publisher.topic_path.return_value = "projects/demo/topics/t"
            mock_pubsub.PublisherClient.return_value = mock_publisher

            svc = PubSubPublishingService(PubSubOptions(project_id="demo"))
            with pytest.raises(PubSubPublishError, match="t"):
                await svc.publish("t", {})

    @pytest.mark.asyncio
    async def test_uses_correct_topic_path(self) -> None:
        with patch("hermes.services.pubsub_publishing_service.pubsub_v1") as mock_pubsub:
            mock_publisher = MagicMock()
            mock_future = MagicMock()
            mock_future.result.return_value = "id"
            mock_publisher.publish.return_value = mock_future
            mock_publisher.topic_path.return_value = "projects/p/topics/t"
            mock_pubsub.PublisherClient.return_value = mock_publisher

            svc = PubSubPublishingService(PubSubOptions(project_id="p"))
            await svc.publish("t", {})

        mock_publisher.topic_path.assert_called_once_with("p", "t")

    def test_sets_emulator_env_var(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PUBSUB_EMULATOR_HOST", raising=False)
        with patch("hermes.services.pubsub_publishing_service.pubsub_v1") as mock_pubsub:
            mock_pubsub.PublisherClient.return_value = MagicMock()
            PubSubPublishingService(
                PubSubOptions(project_id="demo", emulator_host="localhost:8085")
            )
        import os
        assert os.environ.get("PUBSUB_EMULATOR_HOST") == "localhost:8085"
