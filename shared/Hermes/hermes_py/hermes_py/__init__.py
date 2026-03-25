"""Hermes — the shared messaging abstraction library for Elastic Resume Base.

Hermes decouples Python services from any specific messaging transport (SMTP,
SendGrid, Slack, etc.) so that swapping providers requires only a configuration
change — no consuming service needs to be refactored.

Quick start — messaging (SMTP)::

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

Quick start — Pub/Sub (Google Cloud)::

    from hermes_py import initialize_pubsub_from_env, get_publisher

    # Call once at application startup.
    initialize_pubsub_from_env()  # reads GCP_PROJECT_ID from environment

    # Anywhere in your service:
    publisher = get_publisher()
    publisher.publish("resume-ingested", {"resumeId": "abc-123", "status": "ok"})
"""

from hermes_py.interfaces.messaging_service import IMessagingService, Message
from hermes_py.interfaces.publisher import IPublisher
from hermes_py.messaging import (
    _reset_messaging_for_testing,
    get_messaging_service,
    initialize_messaging,
    initialize_messaging_from_env,
)
from hermes_py.options import MessagingOptions
from hermes_py.pubsub import (
    _reset_pubsub_for_testing,
    get_publisher,
    initialize_pubsub,
    initialize_pubsub_from_env,
)
from hermes_py.services.smtp_messaging_service import SmtpMessagingService

__all__ = [
    # Messaging interface & message model
    "IMessagingService",
    "Message",
    # Messaging configuration
    "MessagingOptions",
    # Messaging initialisation
    "initialize_messaging",
    "initialize_messaging_from_env",
    # Messaging singleton accessor
    "get_messaging_service",
    # Messaging concrete implementations
    "SmtpMessagingService",
    # Messaging test helper
    "_reset_messaging_for_testing",
    # Pub/Sub interface
    "IPublisher",
    # Pub/Sub initialisation
    "initialize_pubsub",
    "initialize_pubsub_from_env",
    # Pub/Sub singleton accessor
    "get_publisher",
    # Pub/Sub test helper
    "_reset_pubsub_for_testing",
]
