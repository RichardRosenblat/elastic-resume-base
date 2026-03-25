"""Hermes messaging layer initialisation and singleton management."""

from __future__ import annotations

import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

from hermes.interfaces.messaging_service import IMessagingService
from hermes.options import MessagingOptions
from hermes.services.smtp_messaging_service import SmtpMessagingService

logger = logging.getLogger(__name__)

_service: IMessagingService | None = None


class _SmtpEnvConfig(BaseSettings):
    """Internal settings model for loading SMTP configuration from environment variables.

    All field names correspond to environment variables after uppercasing:
    ``smtp_host`` → ``SMTP_HOST``, etc.
    """

    model_config = SettingsConfigDict(
        env_file=None,
        extra="ignore",
        populate_by_name=True,
    )

    smtp_host: str
    smtp_port: int
    smtp_secure: bool = False
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str


def initialize_messaging(options: MessagingOptions) -> None:
    """Initialise the Hermes messaging layer with explicit configuration.

    This is the primary initialisation path when configuration is passed
    programmatically (e.g. from a config object loaded at application startup).

    Calling this function more than once has no effect — the first call wins
    (idempotent).

    Args:
        options: Messaging transport configuration.

    Example:
        >>> from hermes import initialize_messaging
        >>> from hermes.options import MessagingOptions
        >>> initialize_messaging(
        ...     MessagingOptions(
        ...         host="smtp.example.com",
        ...         port=587,
        ...         from_address="noreply@example.com",
        ...     )
        ... )
    """
    global _service
    if _service is not None:
        return
    _service = SmtpMessagingService(options)
    logger.debug("Hermes messaging layer initialised (explicit config).")


def initialize_messaging_from_env() -> None:
    """Initialise the Hermes messaging layer from environment variables.

    Reads the following variables (sourced from ``config.yaml`` via the
    service's startup config loader):

    +-----------------+----------+---------------------------------------------------+
    | Variable        | Required | Description                                       |
    +=================+==========+===================================================+
    | ``SMTP_HOST``   | ✓        | SMTP server hostname                              |
    +-----------------+----------+---------------------------------------------------+
    | ``SMTP_PORT``   | ✓        | SMTP server port                                  |
    +-----------------+----------+---------------------------------------------------+
    | ``SMTP_SECURE`` | –        | ``"true"`` to enable TLS (default: ``"false"``)   |
    +-----------------+----------+---------------------------------------------------+
    | ``SMTP_USER``   | –        | SMTP username; omit for unauthenticated relays    |
    +-----------------+----------+---------------------------------------------------+
    |``SMTP_PASSWORD``| –        | SMTP password; omit for unauthenticated relays    |
    +-----------------+----------+---------------------------------------------------+
    | ``SMTP_FROM``   | ✓        | Sender ``From`` address                           |
    +-----------------+----------+---------------------------------------------------+

    Calling this function more than once has no effect (idempotent).

    Raises:
        pydantic_core.ValidationError: If any required environment variable is
            missing or cannot be coerced to the expected type.

    Example:
        >>> from hermes import initialize_messaging_from_env
        >>> initialize_messaging_from_env()  # call once at application startup
    """
    global _service
    if _service is not None:
        return
    cfg = _SmtpEnvConfig()  # type: ignore[call-arg]
    _service = SmtpMessagingService(
        MessagingOptions(
            host=cfg.smtp_host,
            port=cfg.smtp_port,
            secure=cfg.smtp_secure,
            user=cfg.smtp_user,
            password=cfg.smtp_password,
            from_address=cfg.smtp_from,
        )
    )
    logger.debug("Hermes messaging layer initialised from environment.")


def get_messaging_service() -> IMessagingService:
    """Return the initialised messaging service singleton.

    Returns:
        The active :class:`~hermes.interfaces.messaging_service.IMessagingService`
        instance.

    Raises:
        RuntimeError: If neither :func:`initialize_messaging` nor
            :func:`initialize_messaging_from_env` has been called.

    Example:
        >>> from hermes import get_messaging_service
        >>> from hermes.interfaces import Message
        >>> messaging = get_messaging_service()
        >>> messaging.send(Message(to="ops@example.com", subject="Alert", body="Something failed."))
    """
    if _service is None:
        raise RuntimeError(
            "Hermes has not been initialised. "
            "Call initialize_messaging() or initialize_messaging_from_env() "
            "before using get_messaging_service()."
        )
    return _service


def _reset_messaging_for_testing() -> None:
    """Reset the internal messaging singleton.

    **For testing only.**  Call this in ``setup`` / ``teardown`` fixtures to
    ensure test isolation when testing code that calls
    :func:`initialize_messaging` or :func:`initialize_messaging_from_env`.
    """
    global _service
    _service = None
