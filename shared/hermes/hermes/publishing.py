"""Hermes event-publishing layer initialisation and singleton management."""

from __future__ import annotations

import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

from hermes.interfaces.event_publisher import IEventPublisher
from hermes.services.pubsub_event_publisher import PubSubEventPublisher

logger = logging.getLogger(__name__)

_publisher: IEventPublisher | None = None


class _PubSubEnvConfig(BaseSettings):
    """Internal settings model for loading Pub/Sub configuration from environment variables.

    All field names correspond to environment variables after uppercasing:
    ``gcp_project_id`` → ``GCP_PROJECT_ID``.
    """

    model_config = SettingsConfigDict(
        env_file=None,
        extra="ignore",
        populate_by_name=True,
    )

    gcp_project_id: str


def initialize_pubsub(project_id: str) -> None:
    """Initialise the Hermes event-publishing layer with an explicit project ID.

    This is the primary initialisation path when the GCP project ID is available
    programmatically (e.g. loaded from ``config.yaml`` at startup).

    Calling this function more than once has no effect — the first call wins
    (idempotent).

    Args:
        project_id: The Google Cloud project ID that owns the Pub/Sub topics.

    Example:
        >>> from hermes import initialize_pubsub
        >>> initialize_pubsub("my-gcp-project")
    """
    global _publisher
    if _publisher is not None:
        return
    _publisher = PubSubEventPublisher(project_id=project_id)
    logger.debug("Hermes event-publishing layer initialised (explicit project ID).")


def initialize_pubsub_from_env() -> None:
    """Initialise the Hermes event-publishing layer from environment variables.

    Reads the following variable:

    +--------------------+----------+-------------------------------------------+
    | Variable           | Required | Description                               |
    +====================+==========+===========================================+
    | ``GCP_PROJECT_ID`` | ✓        | Google Cloud project ID                   |
    +--------------------+----------+-------------------------------------------+

    Calling this function more than once has no effect (idempotent).

    Raises:
        pydantic_core.ValidationError: If ``GCP_PROJECT_ID`` is missing.

    Example:
        >>> from hermes import initialize_pubsub_from_env
        >>> initialize_pubsub_from_env()  # call once at application startup
    """
    global _publisher
    if _publisher is not None:
        return
    cfg = _PubSubEnvConfig()  # type: ignore[call-arg]
    _publisher = PubSubEventPublisher(project_id=cfg.gcp_project_id)
    logger.debug("Hermes event-publishing layer initialised from environment.")


def get_event_publisher() -> IEventPublisher:
    """Return the initialised event-publisher singleton.

    Returns:
        The active :class:`~hermes.interfaces.event_publisher.IEventPublisher`
        instance.

    Raises:
        RuntimeError: If neither :func:`initialize_pubsub` nor
            :func:`initialize_pubsub_from_env` has been called.

    Example:
        >>> from hermes import get_event_publisher
        >>> from hermes.interfaces.event_publisher import PublishPayload
        >>> publisher = get_event_publisher()
        >>> publisher.publish("resume-ingested", PublishPayload(data={"resumeId": "abc"}))
    """
    if _publisher is None:
        raise RuntimeError(
            "Hermes event publisher has not been initialised. "
            "Call initialize_pubsub() or initialize_pubsub_from_env() "
            "before using get_event_publisher()."
        )
    return _publisher


def _reset_pubsub_for_testing() -> None:
    """Reset the internal event-publisher singleton.

    **For testing only.**  Call this in ``setup`` / ``teardown`` fixtures to
    ensure test isolation when testing code that calls
    :func:`initialize_pubsub` or :func:`initialize_pubsub_from_env`.
    """
    global _publisher
    _publisher = None
