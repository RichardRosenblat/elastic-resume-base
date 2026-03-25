"""Hermes — the shared messaging abstraction library for Elastic Resume Base.

Hermes decouples Python services from any specific messaging transport (SMTP,
SendGrid, Slack, etc.) so that swapping providers requires only a configuration
change — no consuming service needs to be refactored.

Quick start::

    from hermes_py import initialize_messaging_from_env, get_messaging_service
    from hermes_py.interfaces import Message

    # Call once at application startup (after config.yaml has been loaded).
    initialize_messaging_from_env()

    # Anywhere in your service:
    messaging = get_messaging_service()
    messaging.send(
        Message(
            to="ops@example.com",
            subject="DLQ job failed",
            body="The job resume-ingestion-001 exceeded its retry limit.",
        )
    )
"""

from hermes_py.interfaces.messaging_service import IMessagingService, Message
from hermes_py.messaging import (
    _reset_messaging_for_testing,
    get_messaging_service,
    initialize_messaging,
    initialize_messaging_from_env,
)
from hermes_py.options import MessagingOptions
from hermes_py.services.smtp_messaging_service import SmtpMessagingService

__all__ = [
    # Interface & message model
    "IMessagingService",
    "Message",
    # Configuration
    "MessagingOptions",
    # Initialisation
    "initialize_messaging",
    "initialize_messaging_from_env",
    # Singleton accessor
    "get_messaging_service",
    # Concrete implementations
    "SmtpMessagingService",
    # Test helper
    "_reset_messaging_for_testing",
]
