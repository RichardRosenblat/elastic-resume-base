"""Pub/Sub publishing service interface."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class IPubSubService(Protocol):
    """Abstraction over any Pub/Sub publishing transport.

    Services depend on this protocol rather than the concrete GCP
    implementation so that the transport can be swapped or mocked without
    touching business logic.

    Example:
        >>> class MyWorker:
        ...     def __init__(self, pubsub: IPubSubService) -> None:
        ...         self._pubsub = pubsub
        ...
        ...     async def run(self, resume_id: str) -> None:
        ...         await self._pubsub.publish("resume_indexing", {"resumeId": resume_id})
    """

    async def publish(self, topic: str, payload: dict[str, Any]) -> str:
        """Publish a JSON payload to a Pub/Sub topic.

        Args:
            topic: Short topic name (e.g. ``"resume_indexing"``).
            payload: Data to serialise as JSON and publish.

        Returns:
            The message ID assigned by the broker.

        Raises:
            Exception: If the publish call fails.
        """
        ...
