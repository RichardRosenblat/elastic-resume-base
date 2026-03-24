"""Google Cloud Pub/Sub implementation of IPubSubService."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from google.cloud import pubsub_v1  # type: ignore[attr-defined]

from hermes.pubsub_options import PubSubOptions

logger = logging.getLogger(__name__)


class PubSubPublishError(Exception):
    """Raised when a Pub/Sub publish call fails."""


class PubSubPublishingService:
    """Google Cloud Pub/Sub implementation of
    :class:`~hermes.interfaces.pubsub_service.IPubSubService`.

    All connection details are supplied via :class:`~hermes.pubsub_options.PubSubOptions`
    at construction time — no values are hardcoded or read from the environment
    here; callers are responsible for sourcing configuration.

    Args:
        options: Pub/Sub connection configuration.

    Example:
        >>> from hermes.pubsub_options import PubSubOptions
        >>> from hermes.services.pubsub_publishing_service import PubSubPublishingService
        >>> service = PubSubPublishingService(PubSubOptions(project_id="my-project"))
        >>> await service.publish("resume_indexing", {"resumeId": "abc123"})
    """

    def __init__(self, options: PubSubOptions) -> None:
        self._options = options
        if options.emulator_host:
            os.environ.setdefault("PUBSUB_EMULATOR_HOST", options.emulator_host)
        self._publisher: pubsub_v1.PublisherClient = pubsub_v1.PublisherClient()

    def _topic_path(self, topic: str) -> str:
        return self._publisher.topic_path(self._options.project_id, topic)

    async def publish(self, topic: str, payload: dict[str, Any]) -> str:
        """Publish a JSON-encoded payload to a Pub/Sub topic.

        Args:
            topic: Short topic name (e.g. ``"resume_indexing"``).
            payload: Dictionary serialised as UTF-8 JSON bytes.

        Returns:
            The message ID assigned by the Pub/Sub broker.

        Raises:
            PubSubPublishError: If the publish call or future resolution fails.
        """
        topic_path = self._topic_path(topic)
        data = json.dumps(payload).encode("utf-8")
        logger.info("Publishing message to Pub/Sub topic", extra={"topic": topic})
        try:
            future = self._publisher.publish(topic_path, data)
            message_id: str = future.result()
            logger.debug(
                "Pub/Sub message published",
                extra={"topic": topic, "message_id": message_id},
            )
            return message_id
        except Exception as exc:
            logger.error(
                "Pub/Sub publish failed", extra={"topic": topic, "error": str(exc)}
            )
            raise PubSubPublishError(
                f"Failed to publish to topic '{topic}': {exc}"
            ) from exc
