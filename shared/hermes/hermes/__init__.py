"""Hermes — the shared messaging abstraction library for Elastic Resume Base.

Hermes decouples Python services from any specific messaging transport (SMTP,
SendGrid, Slack, etc.) so that swapping providers requires only a configuration
change — no consuming service needs to be refactored.

It also provides a Pub/Sub publishing abstraction so that services publish
events without directly depending on ``google-cloud-pubsub``.

Quick start — SMTP::

    from hermes import initialize_messaging_from_env, get_messaging_service
    from hermes.interfaces import Message

    initialize_messaging_from_env()
    messaging = get_messaging_service()
    messaging.send(Message(to="ops@example.com", subject="DLQ alert", body="..."))

Quick start — Pub/Sub::

    from hermes.pubsub import initialize_pubsub_from_env, get_pubsub_service

    initialize_pubsub_from_env()
    pubsub = get_pubsub_service()
    await pubsub.publish("resume_indexing", {"resumeId": "abc123"})
"""

from hermes.interfaces.messaging_service import IMessagingService, Message
from hermes.interfaces.pubsub_service import IPubSubService
from hermes.messaging import (
    _reset_messaging_for_testing,
    get_messaging_service,
    initialize_messaging,
    initialize_messaging_from_env,
)
from hermes.options import MessagingOptions
from hermes.pubsub import (
    _reset_pubsub_for_testing,
    get_pubsub_service,
    initialize_pubsub,
    initialize_pubsub_from_env,
)
from hermes.pubsub_options import PubSubOptions
from hermes.services.pubsub_publishing_service import PubSubPublishError, PubSubPublishingService
from hermes.services.smtp_messaging_service import SmtpMessagingService

__all__ = [
    # Messaging interface & model
    "IMessagingService",
    "Message",
    # Messaging configuration
    "MessagingOptions",
    # Messaging initialisation
    "initialize_messaging",
    "initialize_messaging_from_env",
    # Messaging singleton
    "get_messaging_service",
    # Messaging implementations
    "SmtpMessagingService",
    # Messaging test helper
    "_reset_messaging_for_testing",
    # Pub/Sub interface
    "IPubSubService",
    # Pub/Sub configuration
    "PubSubOptions",
    # Pub/Sub initialisation
    "initialize_pubsub",
    "initialize_pubsub_from_env",
    # Pub/Sub singleton
    "get_pubsub_service",
    # Pub/Sub implementations
    "PubSubPublishingService",
    "PubSubPublishError",
    # Pub/Sub test helper
    "_reset_pubsub_for_testing",
]
