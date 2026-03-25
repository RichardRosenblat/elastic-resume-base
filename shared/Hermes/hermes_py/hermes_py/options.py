"""Messaging transport configuration options."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class MessagingOptions:
    """Configuration options for the Hermes messaging layer.

    Pass these options to :func:`~hermes.messaging.initialize_messaging` to
    configure the messaging transport explicitly, or use
    :func:`~hermes.messaging.initialize_messaging_from_env` to load them
    automatically from environment variables.

    Attributes:
        host: SMTP server hostname (e.g. ``"smtp.example.com"``).
        port: SMTP server port (e.g. ``587`` for STARTTLS, ``465`` for SSL,
            ``25`` for plain).
        from_address: The ``From`` address used for all outgoing messages
            (e.g. ``"noreply@example.com"``).
        secure: Whether to wrap the connection in TLS from the start.
            ``True`` → SMTPS (port 465).  ``False`` → plain or STARTTLS
            (ports 25 / 587).  Defaults to ``False``.
        user: SMTP authentication username.  Omit for unauthenticated relays.
        password: SMTP authentication password.  Omit for unauthenticated relays.

    Example:
        >>> opts = MessagingOptions(
        ...     host="smtp.example.com",
        ...     port=587,
        ...     from_address="noreply@example.com",
        ... )
    """

    host: str
    port: int
    from_address: str
    secure: bool = False
    user: str | None = None
    password: str | None = None
