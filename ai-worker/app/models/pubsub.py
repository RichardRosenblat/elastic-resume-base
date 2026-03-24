"""Pub/Sub message envelope models for the AI Worker service."""

from __future__ import annotations

import base64
import json

from pydantic import BaseModel, field_validator


class PubSubMessage(BaseModel):
    """A single Pub/Sub message as delivered in a push notification.

    Attributes:
        data: Base64-encoded message payload.
        message_id: Pub/Sub-assigned message identifier.
        attributes: Optional key-value metadata attached to the message.
    """

    data: str
    message_id: str
    attributes: dict[str, str] = {}

    def decode_data(self) -> dict[str, str]:
        """Decode the base64-encoded ``data`` field and parse it as JSON.

        Returns:
            The decoded JSON payload as a dictionary.

        Raises:
            ValueError: If the payload cannot be decoded or is not valid JSON.
        """
        try:
            raw = base64.b64decode(self.data).decode("utf-8")
            return json.loads(raw)  # type: ignore[no-any-return]
        except Exception as exc:
            raise ValueError(f"Failed to decode Pub/Sub message data: {exc}") from exc


class PubSubPushEnvelope(BaseModel):
    """Outer envelope for a Pub/Sub push HTTP request.

    Google Pub/Sub wraps the message inside a ``{"message": ..., "subscription": ...}``
    JSON body when using push delivery.

    Attributes:
        message: The inner Pub/Sub message.
        subscription: The fully qualified subscription name.
    """

    message: PubSubMessage
    subscription: str

    @field_validator("subscription")
    @classmethod
    def subscription_must_not_be_empty(cls, value: str) -> str:
        """Validate that the subscription name is non-empty.

        Args:
            value: The subscription string to validate.

        Returns:
            The validated subscription string.

        Raises:
            ValueError: If the value is an empty string.
        """
        if not value.strip():
            raise ValueError("subscription must not be empty")
        return value
