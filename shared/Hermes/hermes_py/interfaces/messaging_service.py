"""Messaging service interface and message model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass
class Message:
    """A message to be delivered via a messaging transport.

    Attributes:
        to: One or more recipient addresses (e.g. email addresses).
        subject: Subject line or title of the message.
        body: Body text of the message.
        is_html: When ``True``, the body is treated as HTML.
            Defaults to ``False`` (plain text).

    Example:
        >>> msg = Message(
        ...     to=["ops@example.com", "alerts@example.com"],
        ...     subject="Job failure in DLQ",
        ...     body="The following job failed: resume-ingestion-001",
        ... )
    """

    to: str | list[str]
    subject: str
    body: str
    is_html: bool = False


@runtime_checkable
class IMessagingService(Protocol):
    """Abstraction over any messaging transport (SMTP, Slack, SendGrid, etc.).

    Services should depend on this protocol rather than on any concrete
    implementation, so that the transport can be swapped without touching
    business logic.

    Example:
        >>> class AlertService:
        ...     def __init__(self, messaging: IMessagingService) -> None:
        ...         self._messaging = messaging
        ...
        ...     def send_alert(self, text: str) -> None:
        ...         self._messaging.send(
        ...             Message(to="ops@example.com", subject="Alert", body=text)
        ...         )
    """

    def send(self, message: Message) -> None:
        """Send a message to one or more recipients.

        Args:
            message: The message to deliver.

        Raises:
            Exception: If the transport rejects the message or is unreachable.
        """
        ...
