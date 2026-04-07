"""Pydantic models for Pub/Sub message handling."""

from __future__ import annotations

import base64
import json

from pydantic import BaseModel, Field


class PubSubMessage(BaseModel):
    """A single message from Google Cloud Pub/Sub.

    Attributes:
        data: Base64-encoded JSON payload.
        message_id: Unique message identifier.
        publish_time: RFC3339 timestamp string of when the message was published.
        attributes: Optional key-value metadata attached to the message.
    """

    data: str
    message_id: str = Field(alias="messageId")
    publish_time: str = Field(alias="publishTime")
    attributes: dict[str, str] = Field(default_factory=dict)

    def decode_data(self) -> dict:
        """Decode the base64-encoded data field to a Python dictionary.

        Returns:
            The decoded JSON payload as a dictionary.

        Raises:
            PubSubMessageError: If the data field cannot be decoded or parsed.
        """
        from app.utils.exceptions import PubSubMessageError

        try:
            decoded_bytes = base64.b64decode(self.data)
            decoded_str = decoded_bytes.decode("utf-8")
            return json.loads(decoded_str)
        except Exception as exc:
            raise PubSubMessageError(f"Failed to decode message data: {exc}") from exc


class PubSubPushEnvelope(BaseModel):
    """The outer envelope for a Google Cloud Pub/Sub push request.

    Attributes:
        message: The contained Pub/Sub message.
        subscription: The full subscription resource name (e.g.
            ``projects/my-project/subscriptions/my-sub``).
    """

    message: PubSubMessage
    subscription: str


class ResumeIndexedPayload(BaseModel):
    """The expected payload in a ``resume-indexed`` Pub/Sub message.

    Attributes:
        resume_id: Unique identifier for the resume that was indexed.
    """

    resume_id: str = Field(alias="resumeId")
