"""Pub/Sub publisher service for the AI Worker.

Wraps the Google Cloud Pub/Sub client so it can be easily mocked in unit tests.
"""

from __future__ import annotations

import json
import logging

from google.cloud import pubsub_v1  # type: ignore[attr-defined]

logger = logging.getLogger(__name__)


class PubSubPublishError(Exception):
    """Raised when a Pub/Sub publish call fails."""


class PubSubService:
    """Thin wrapper around the Google Cloud Pub/Sub publisher.

    Args:
        project_id: GCP project identifier.

    Example:
        >>> service = PubSubService(project_id="my-project")
        >>> await service.publish("resume-indexed", {"resumeId": "abc123"})
    """

    def __init__(self, project_id: str) -> None:
        self._project_id = project_id
        self._publisher = pubsub_v1.PublisherClient()

    def _topic_path(self, topic_name: str) -> str:
        return self._publisher.topic_path(self._project_id, topic_name)

    async def publish(self, topic_name: str, payload: dict[str, str]) -> None:
        """Publish a JSON payload to a Pub/Sub topic.

        The payload is serialised to JSON and encoded as UTF-8 bytes before
        publishing.

        Args:
            topic_name: The short topic name (e.g. ``"resume-indexed"``).
            payload: A dictionary that will be serialised to JSON.

        Raises:
            PubSubPublishError: If the publish call raises an exception.
        """
        topic_path = self._topic_path(topic_name)
        data = json.dumps(payload).encode("utf-8")
        logger.info(
            "Publishing message to Pub/Sub topic",
            extra={"topic": topic_name},
        )
        try:
            future = self._publisher.publish(topic_path, data)
            # Block until the publish is acknowledged (returns the message ID).
            message_id: str = future.result()
            logger.debug(
                "Pub/Sub message published",
                extra={"topic": topic_name, "message_id": message_id},
            )
        except Exception as exc:
            logger.error(
                "Pub/Sub publish failed",
                extra={"topic": topic_name, "error": str(exc)},
            )
            raise PubSubPublishError(
                f"Failed to publish to topic {topic_name!r}: {exc}"
            ) from exc
