"""Configuration options for the Hermes Pub/Sub layer."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class PubSubOptions:
    """Configuration for the Pub/Sub publishing service.

    Attributes:
        project_id: GCP project identifier.
        emulator_host: Optional ``host:port`` for the Pub/Sub emulator
            (e.g. ``"firebase-emulator:8085"``).  When set, the
            ``PUBSUB_EMULATOR_HOST`` environment variable is populated before
            the publisher client is created so the Google SDK routes to the
            emulator automatically.

    Example:
        >>> opts = PubSubOptions(project_id="demo-project")
        >>> opts_emulator = PubSubOptions(
        ...     project_id="demo",
        ...     emulator_host="localhost:8085",
        ... )
    """

    project_id: str
    emulator_host: str | None = None
