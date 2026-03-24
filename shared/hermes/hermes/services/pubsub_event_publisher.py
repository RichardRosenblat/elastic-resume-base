"""Cloud Pub/Sub implementation of IEventPublisher."""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from hermes.interfaces.event_publisher import IEventPublisher, PublishPayload

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class PubSubEventPublisher:
    """Google Cloud Pub/Sub implementation of :class:`~hermes.interfaces.event_publisher.IEventPublisher`.

    Serialises :attr:`~hermes.interfaces.event_publisher.PublishPayload.data` as UTF-8
    JSON and optionally attaches
    :attr:`~hermes.interfaces.event_publisher.PublishPayload.attributes` as Pub/Sub
    message attributes.

    All connection details (project ID) are supplied at construction time — no
    values are hardcoded or read from the environment here.

    Example:
        >>> from hermes.services.pubsub_event_publisher import PubSubEventPublisher
        >>> from hermes.interfaces.event_publisher import PublishPayload
        >>> publisher = PubSubEventPublisher(project_id="my-gcp-project")
        >>> msg_id = publisher.publish(
        ...     "resume-ingested",
        ...     PublishPayload(data={"resumeId": "resume-abc123"}),
        ... )
    """

    def __init__(
        self,
        project_id: str,
        publisher_factory: Callable[[], Any] | None = None,
    ) -> None:
        """Initialise the Pub/Sub event publisher.

        Args:
            project_id: The Google Cloud project ID that owns the Pub/Sub topics.
            publisher_factory: Optional callable that returns a ready-to-use
                ``google.cloud.pubsub_v1.PublisherClient`` instance.  Provide
                this in tests to inject a mock client and avoid real GCP calls.
                When ``None`` (the default), a real client is created.
        """
        self._project_id = project_id
        self._publisher_factory = publisher_factory
        self._client: Any = None

    def _get_client(self) -> Any:
        """Return the Pub/Sub publisher client, creating it lazily on first use.

        Returns:
            A ``google.cloud.pubsub_v1.PublisherClient`` instance.
        """
        if self._client is None:
            if self._publisher_factory is not None:
                self._client = self._publisher_factory()
            else:
                from google.cloud import pubsub_v1

                self._client = pubsub_v1.PublisherClient()
        return self._client

    def publish(self, topic: str, payload: PublishPayload) -> str:
        """Publish a message to a Cloud Pub/Sub topic.

        The :attr:`~hermes.interfaces.event_publisher.PublishPayload.data` dict is
        serialised as UTF-8 JSON.
        :attr:`~hermes.interfaces.event_publisher.PublishPayload.attributes` are
        forwarded as Pub/Sub message attributes (all values must be strings).

        Args:
            topic: Short topic name (e.g. ``"resume-ingested"``).  The full
                resource path ``projects/<project>/topics/<topic>`` is constructed
                internally.
            payload: The event data and optional string attributes.

        Returns:
            The Pub/Sub-assigned message ID.

        Raises:
            google.api_core.exceptions.GoogleAPIError: If the Pub/Sub service
                rejects the message or is unreachable.

        Example:
            >>> msg_id = publisher.publish(
            ...     "resume-ingested",
            ...     PublishPayload(
            ...         data={"resumeId": "resume-abc123"},
            ...         attributes={"source": "ingestor"},
            ...     ),
            ... )
        """
        client = self._get_client()
        topic_path: str = client.topic_path(self._project_id, topic)
        encoded = json.dumps(payload.data).encode("utf-8")
        future = client.publish(topic_path, data=encoded, **payload.attributes)
        message_id: str = future.result()
        logger.debug(
            "Published message %s to topic '%s' (project '%s').",
            message_id,
            topic,
            self._project_id,
        )
        return message_id
