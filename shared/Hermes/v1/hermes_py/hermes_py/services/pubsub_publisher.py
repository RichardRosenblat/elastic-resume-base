"""Google Cloud Pub/Sub implementation of the Hermes Publisher interface."""

from __future__ import annotations

import json
import logging
from typing import Any

from hermes_py.interfaces.publisher import IPublisher

logger = logging.getLogger(__name__)


class PubSubPublisher(IPublisher):
    """Google Cloud Pub/Sub implementation of :class:`~hermes_py.interfaces.publisher.IPublisher`.

    Publishes JSON-encoded messages to Google Cloud Pub/Sub topics.  All
    connection details are derived from the project ID supplied at construction
    time; Application Default Credentials (ADC) are used for authentication,
    exactly as with every other GCP client library.

    The ``google-cloud-pubsub`` package is an **optional** dependency of Hermes.
    Install it with the ``pubsub`` extra::

        pip install "elastic-resume-base-hermes[pubsub]"

    Example::

        from hermes_py.services.pubsub_publisher import PubSubPublisher

        publisher = PubSubPublisher(project_id="my-gcp-project")
        publisher.publish("my-topic", {"event": "resume_ingested", "id": "abc-123"})

    Args:
        project_id: GCP project ID that owns the topics.
    """

    def __init__(self, project_id: str) -> None:
        """Initialise the publisher for the given GCP project.

        Args:
            project_id: GCP project ID that owns the Pub/Sub topics.

        Raises:
            ImportError: If ``google-cloud-pubsub`` is not installed.
        """
        try:
            from google.cloud import pubsub_v1  # type: ignore[import-untyped]
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "The 'google-cloud-pubsub' package is required for PubSubPublisher. "
                "Install it with: pip install 'elastic-resume-base-hermes[pubsub]'"
            ) from exc

        self._project_id = project_id
        self._client = pubsub_v1.PublisherClient()

    def publish(self, topic: str, data: dict[str, Any]) -> None:
        """Publish *data* as a JSON-encoded Pub/Sub message to *topic*.

        The topic path is resolved to
        ``projects/{project_id}/topics/{topic}`` using the project ID
        supplied at construction time.

        Args:
            topic: Short topic name (e.g. ``"resume-ingested"``).
            data: JSON-serialisable payload dict.  Will be encoded to UTF-8
                bytes before publishing.

        Raises:
            google.api_core.exceptions.GoogleAPIError: If the Pub/Sub call
                fails at the transport or API level.
            Exception: Any other unexpected error from the client library.

        Example::

            publisher.publish("resume-ingested", {"resumeId": "abc-123", "status": "ok"})
        """
        topic_path = self._client.topic_path(self._project_id, topic)
        payload = json.dumps(data).encode("utf-8")
        future = self._client.publish(topic_path, payload)
        message_id = future.result()
        logger.debug(
            "Published Pub/Sub message",
            extra={"topic": topic, "message_id": message_id},
        )
