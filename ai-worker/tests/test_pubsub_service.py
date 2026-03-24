"""Unit tests for the PubSubService."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.pubsub_service import PubSubPublishError, PubSubService


class TestPubSubServicePublish:
    """Tests for PubSubService.publish()."""

    @pytest.mark.asyncio
    async def test_publishes_json_encoded_payload(self) -> None:
        """publish() encodes the payload as JSON bytes and calls the publisher."""
        with patch("app.services.pubsub_service.pubsub_v1") as mock_pubsub_v1:
            mock_publisher = MagicMock()
            mock_future = MagicMock()
            mock_future.result.return_value = "msg-id-001"
            mock_publisher.publish.return_value = mock_future
            mock_publisher.topic_path.return_value = "projects/demo/topics/resume-indexed"
            mock_pubsub_v1.PublisherClient.return_value = mock_publisher

            service = PubSubService(project_id="demo")
            await service.publish("resume-indexed", {"resumeId": "abc123"})

        mock_publisher.publish.assert_called_once()
        call_args = mock_publisher.publish.call_args
        topic_path = call_args[0][0]
        data = call_args[0][1]
        assert "resume-indexed" in topic_path
        assert b"abc123" in data

    @pytest.mark.asyncio
    async def test_raises_pubsub_publish_error_on_failure(self) -> None:
        """publish() raises PubSubPublishError when the publisher fails."""
        with patch("app.services.pubsub_service.pubsub_v1") as mock_pubsub_v1:
            mock_publisher = MagicMock()
            mock_future = MagicMock()
            mock_future.result.side_effect = RuntimeError("Pub/Sub unavailable")
            mock_publisher.publish.return_value = mock_future
            mock_publisher.topic_path.return_value = "projects/demo/topics/bad-topic"
            mock_pubsub_v1.PublisherClient.return_value = mock_publisher

            service = PubSubService(project_id="demo")
            with pytest.raises(PubSubPublishError, match="bad-topic"):
                await service.publish("bad-topic", {"resumeId": "xyz"})

    @pytest.mark.asyncio
    async def test_uses_correct_topic_path(self) -> None:
        """publish() constructs the full topic path using project_id."""
        with patch("app.services.pubsub_service.pubsub_v1") as mock_pubsub_v1:
            mock_publisher = MagicMock()
            mock_future = MagicMock()
            mock_future.result.return_value = "msg-id"
            mock_publisher.publish.return_value = mock_future
            mock_publisher.topic_path.return_value = (
                "projects/my-project/topics/resume-indexed"
            )
            mock_pubsub_v1.PublisherClient.return_value = mock_publisher

            service = PubSubService(project_id="my-project")
            await service.publish("resume-indexed", {"resumeId": "abc"})

        mock_publisher.topic_path.assert_called_once_with("my-project", "resume-indexed")
