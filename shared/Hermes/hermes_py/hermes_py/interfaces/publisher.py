"""Publisher interface for the Hermes Pub/Sub abstraction."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class IPublisher(Protocol):
    """Abstraction over any Pub/Sub publishing transport.

    Services should depend on this protocol rather than on any concrete
    implementation. Switching providers (e.g. from Google Cloud Pub/Sub to
    a local emulator or a stub) then requires only a Hermes configuration
    change — no consuming service code needs to be refactored.

    Example::

        from hermes_py.interfaces.publisher import IPublisher

        class OrderService:
            def __init__(self, publisher: IPublisher) -> None:
                self._publisher = publisher

            def place_order(self, order: dict[str, Any]) -> None:
                self._publisher.publish("orders", order)
    """

    def publish(self, topic: str, data: dict[str, Any]) -> None:
        """Publish *data* to the given Pub/Sub *topic*.

        Args:
            topic: The name of the topic to publish to.  The concrete
                implementation is responsible for resolving this to a
                fully-qualified topic path (e.g.
                ``projects/{project}/topics/{topic}``).
            data: A JSON-serialisable dictionary that will be encoded to bytes
                and published as the message payload.

        Raises:
            Exception: If the Pub/Sub transport rejects the message or is
                unreachable.
        """
        ...
