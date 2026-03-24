"""Event publisher interface and publish payload model."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass
class PublishPayload:
    """A payload to be published to an event topic.

    Attributes:
        data: Arbitrary JSON-serialisable dictionary to send as the message body.
        attributes: Optional flat string key/value pairs attached as Pub/Sub message
            attributes (e.g. ``{"event_type": "resume-ingested"}``).

    Example:
        >>> payload = PublishPayload(
        ...     data={"resumeId": "resume-abc123"},
        ...     attributes={"source": "ingestor-service"},
        ... )
    """

    data: dict[str, Any]
    attributes: dict[str, str] = field(default_factory=dict)


@runtime_checkable
class IEventPublisher(Protocol):
    """Abstraction over any event-publishing transport (Cloud Pub/Sub, local emulator, etc.).

    Services should depend on this protocol rather than on any concrete
    implementation so that the transport can be swapped without touching
    business logic.

    Example:
        >>> class IngestService:
        ...     def __init__(self, publisher: IEventPublisher) -> None:
        ...         self._publisher = publisher
        ...
        ...     def emit_ingested(self, resume_id: str) -> None:
        ...         self._publisher.publish(
        ...             "resume-ingested",
        ...             PublishPayload(data={"resumeId": resume_id}),
        ...         )
    """

    def publish(self, topic: str, payload: PublishPayload) -> str:
        """Publish a message to the given topic.

        Args:
            topic: The topic name (short name, not the full resource path).
            payload: The data and optional attributes to publish.

        Returns:
            A transport-specific message identifier (e.g. the Pub/Sub message ID).

        Raises:
            Exception: If the transport rejects the message or is unreachable.
        """
        ...
