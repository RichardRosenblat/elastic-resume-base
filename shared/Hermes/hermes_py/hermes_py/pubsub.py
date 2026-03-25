"""Hermes Pub/Sub layer initialisation and singleton management."""

from __future__ import annotations

import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

from hermes_py.interfaces.publisher import IPublisher
from hermes_py.services.pubsub_publisher import PubSubPublisher

logger = logging.getLogger(__name__)

_publisher: IPublisher | None = None


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
    """Initialise the Hermes Pub/Sub layer with an explicit GCP project ID.

    This is the primary initialisation path when the project ID is known at
    startup (e.g. loaded from a config file).

    Calling this function more than once has no effect — the first call wins
    (idempotent).

    Args:
        project_id: Google Cloud project ID that owns the Pub/Sub topics.

    Example::

        from hermes_py import initialize_pubsub

        initialize_pubsub("my-gcp-project")
    """
    global _publisher
    if _publisher is not None:
        return
    _publisher = PubSubPublisher(project_id=project_id)
    logger.debug("Hermes Pub/Sub layer initialised (explicit project ID).")


def initialize_pubsub_from_env() -> None:
    """Initialise the Hermes Pub/Sub layer from environment variables.

    Reads the following variable:

    +-----------------------+----------+---------------------------------+
    | Variable              | Required | Description                     |
    +=======================+==========+=================================+
    | ``GCP_PROJECT_ID``    | ✓        | Google Cloud project ID         |
    +-----------------------+----------+---------------------------------+

    Calling this function more than once has no effect (idempotent).

    Raises:
        pydantic_core.ValidationError: If ``GCP_PROJECT_ID`` is not set.

    Example::

        from hermes_py import initialize_pubsub_from_env

        initialize_pubsub_from_env()  # call once at application startup
    """
    global _publisher
    if _publisher is not None:
        return
    cfg = _PubSubEnvConfig()  # type: ignore[call-arg]
    _publisher = PubSubPublisher(project_id=cfg.gcp_project_id)
    logger.debug("Hermes Pub/Sub layer initialised from environment.")


def get_publisher() -> IPublisher:
    """Return the initialised Pub/Sub publisher singleton.

    Returns:
        The active :class:`~hermes_py.interfaces.publisher.IPublisher` instance.

    Raises:
        RuntimeError: If neither :func:`initialize_pubsub` nor
            :func:`initialize_pubsub_from_env` has been called.

    Example::

        from hermes_py import get_publisher

        publisher = get_publisher()
        publisher.publish("resume-ingested", {"resumeId": "abc-123"})
    """
    if _publisher is None:
        raise RuntimeError(
            "Hermes Pub/Sub has not been initialised. "
            "Call initialize_pubsub() or initialize_pubsub_from_env() "
            "before using get_publisher()."
        )
    return _publisher


def _reset_pubsub_for_testing() -> None:
    """Reset the internal Pub/Sub publisher singleton.

    **For testing only.**  Call this in ``setup`` / ``teardown`` fixtures to
    ensure test isolation when testing code that calls
    :func:`initialize_pubsub` or :func:`initialize_pubsub_from_env`.
    """
    global _publisher
    _publisher = None
