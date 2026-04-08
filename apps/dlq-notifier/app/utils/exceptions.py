"""Custom exceptions for the DLQ Notifier service."""

from __future__ import annotations


class PubSubMessageError(Exception):
    """Raised when a Pub/Sub push message cannot be decoded or is malformed.

    Attributes:
        message: Human-readable description of the failure.
    """

    def __init__(self, message: str) -> None:
        """Initialise a PubSubMessageError.

        Args:
            message: Human-readable description of the failure.
        """
        super().__init__(message)
        self.message = message


class NotificationError(Exception):
    """Raised when an email notification cannot be delivered.

    Attributes:
        message: Human-readable description of the failure.
    """

    def __init__(self, message: str) -> None:
        """Initialise a NotificationError.

        Args:
            message: Human-readable description of the failure.
        """
        super().__init__(message)
        self.message = message
