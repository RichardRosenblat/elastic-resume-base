"""Hermes Pub/Sub layer — initialisation and singleton management.

Mirrors the messaging singleton pattern in :mod:`hermes.messaging`.

Usage::

    from hermes.pubsub import initialize_pubsub_from_env, get_pubsub_service

    # Call once at application startup:
    initialize_pubsub_from_env()

    # Anywhere in your service:
    pubsub = get_pubsub_service()
    await pubsub.publish("resume_indexing", {"resumeId": "abc123"})
"""

from __future__ import annotations

import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

from hermes.interfaces.pubsub_service import IPubSubService
from hermes.pubsub_options import PubSubOptions
from hermes.services.pubsub_publishing_service import PubSubPublishingService

logger = logging.getLogger(__name__)

_pubsub_service: IPubSubService | None = None


class _PubSubEnvConfig(BaseSettings):
    """Internal settings model for loading Pub/Sub config from environment variables."""

    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    pubsub_project_id: str
    pubsub_emulator_host: str | None = None


def initialize_pubsub(options: PubSubOptions) -> None:
    """Initialise the Hermes Pub/Sub layer with explicit configuration.

    Idempotent — the first call wins; subsequent calls are no-ops.

    Args:
        options: Pub/Sub transport configuration.

    Example:
        >>> from hermes.pubsub import initialize_pubsub
        >>> from hermes.pubsub_options import PubSubOptions
        >>> initialize_pubsub(PubSubOptions(project_id="my-project"))
    """
    global _pubsub_service
    if _pubsub_service is not None:
        return
    _pubsub_service = PubSubPublishingService(options)
    logger.debug("Hermes Pub/Sub layer initialised (explicit config).")


def initialize_pubsub_from_env() -> None:
    """Initialise the Hermes Pub/Sub layer from environment variables.

    Reads the following variables:

    +----------------------------+----------+-----------------------------------------------+
    | Variable                   | Required | Description                                   |
    +============================+==========+===============================================+
    | ``PUBSUB_PROJECT_ID``      | ✓        | GCP project identifier                        |
    +----------------------------+----------+-----------------------------------------------+
    | ``PUBSUB_EMULATOR_HOST``   | –        | ``host:port`` of the Pub/Sub emulator         |
    +----------------------------+----------+-----------------------------------------------+

    Idempotent — the first call wins.

    Raises:
        pydantic_core.ValidationError: If ``PUBSUB_PROJECT_ID`` is missing.

    Example:
        >>> from hermes.pubsub import initialize_pubsub_from_env
        >>> initialize_pubsub_from_env()
    """
    global _pubsub_service
    if _pubsub_service is not None:
        return
    cfg = _PubSubEnvConfig()  # type: ignore[call-arg]
    _pubsub_service = PubSubPublishingService(
        PubSubOptions(
            project_id=cfg.pubsub_project_id,
            emulator_host=cfg.pubsub_emulator_host,
        )
    )
    logger.debug("Hermes Pub/Sub layer initialised from environment.")


def get_pubsub_service() -> IPubSubService:
    """Return the initialised Pub/Sub service singleton.

    Returns:
        The active :class:`~hermes.interfaces.pubsub_service.IPubSubService`.

    Raises:
        RuntimeError: If neither :func:`initialize_pubsub` nor
            :func:`initialize_pubsub_from_env` has been called.

    Example:
        >>> from hermes.pubsub import get_pubsub_service
        >>> pubsub = get_pubsub_service()
        >>> await pubsub.publish("resume_indexing", {"resumeId": "abc"})
    """
    if _pubsub_service is None:
        raise RuntimeError(
            "Hermes Pub/Sub layer has not been initialised. "
            "Call initialize_pubsub() or initialize_pubsub_from_env() first."
        )
    return _pubsub_service


def _reset_pubsub_for_testing() -> None:
    """Reset the Pub/Sub singleton.

    **For testing only.**  Ensures test isolation when multiple tests call the
    ``initialize_pubsub*`` functions.
    """
    global _pubsub_service
    _pubsub_service = None
