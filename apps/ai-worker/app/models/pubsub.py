"""Pydantic models for Google Cloud Pub/Sub push message payloads."""

from __future__ import annotations

import base64
import json
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.utils.exceptions import PubSubMessageError


class PubSubMessage(BaseModel):
    """Inner message envelope delivered by Google Cloud Pub/Sub push.

    Attributes:
        data: Base64-encoded UTF-8 message payload.
        message_id: Server-assigned message identifier.
        publish_time: ISO-8601 timestamp when the message was published.
        attributes: Optional key/value attributes attached to the message.
    """

    data: str = Field(..., description="Base64-encoded message payload.")
    message_id: str = Field(default="", alias="messageId")
    publish_time: str = Field(default="", alias="publishTime")
    attributes: dict[str, str] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}

    def decode_data(self) -> dict[str, Any]:
        """Decode and JSON-parse the base64-encoded ``data`` field.

        Returns:
            The parsed JSON payload as a dictionary.

        Raises:
            PubSubMessageError: If the data cannot be decoded or parsed.
        """
        try:
            raw = base64.b64decode(self.data).decode("utf-8")
        except Exception as exc:
            raise PubSubMessageError(
                f"Failed to base64-decode Pub/Sub message data: {exc}"
            ) from exc
        try:
            return json.loads(raw)  # type: ignore[no-any-return]
        except json.JSONDecodeError as exc:
            raise PubSubMessageError(
                f"Failed to JSON-parse Pub/Sub message payload: {exc}"
            ) from exc


class PubSubPushEnvelope(BaseModel):
    """Outer envelope for a Google Cloud Pub/Sub push request.

    Google Cloud Pub/Sub delivers push messages wrapped in this envelope via
    HTTP POST to the configured push endpoint URL.

    Attributes:
        message: The inner :class:`PubSubMessage` containing the payload.
        subscription: Fully-qualified subscription resource name.

    Example payload::

        {
            "message": {
                "data": "eyJyZXN1bWVJZCI6ICJhYmMtMTIzIn0=",
                "messageId": "1234567890",
                "publishTime": "2024-01-01T00:00:00Z",
                "attributes": {}
            },
            "subscription": "projects/my-project/subscriptions/my-sub"
        }
    """

    message: PubSubMessage
    subscription: str = Field(default="")


class ResumeIngestedPayload(BaseModel):
    """Decoded payload published to the ``resume-ingested`` Pub/Sub topic.

    Attributes:
        resume_id: Firestore document ID of the ingested resume.
    """

    resume_id: str = Field(..., alias="resumeId")

    model_config = {"populate_by_name": True}

    @field_validator("resume_id")
    @classmethod
    def resume_id_not_empty(cls, v: str) -> str:
        """Validate that the resume ID is not empty.

        Args:
            v: The resume ID value.

        Returns:
            The validated resume ID.

        Raises:
            ValueError: If the resume ID is empty.
        """
        if not v.strip():
            raise ValueError("resumeId must not be empty")
        return v.strip()
