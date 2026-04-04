"""Pydantic models for Google Cloud Pub/Sub push message payloads."""

from __future__ import annotations

import base64
import json
from typing import Any

from pydantic import BaseModel, Field

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
            "subscription": "projects/my-project/subscriptions/dlq-notifier-sub"
        }
    """

    message: PubSubMessage
    subscription: str = Field(default="")


class DlqMessagePayload(BaseModel):
    """Decoded payload from the ``dead-letter-queue`` Pub/Sub topic.

    DLQ messages are published by upstream services (Ingestor, AI Worker, etc.)
    when a processing step fails irrecoverably, or forwarded automatically by
    Pub/Sub after a subscription exhausts its maximum delivery attempts.

    Attributes:
        resume_id: Firestore document ID of the resume that failed processing,
            if known.
        error: Human-readable description of the failure.
        service: Name of the service that produced the DLQ message.
        stage: Processing stage at which the failure occurred (e.g.
            ``"download"``, ``"extraction"``).
        error_type: Machine-readable error category (e.g.
            ``"EXTRACTION_ERROR"``).
        user_id: Firebase UID of the user whose action triggered the failure.
            When present, the notification is categorised as a ``"user"``
            letter; otherwise it defaults to ``"system"``.
        category: Explicit notification category — ``"user"`` for failures
            caused by user actions, ``"system"`` for infrastructure/platform
            failures.  When omitted the category is inferred from the presence
            of ``userId``.
        user_message: User-friendly description of the failure to show in the
            notification panel.  Falls back to ``error`` when absent.
    """

    resume_id: str | None = Field(default=None, alias="resumeId")
    error: str | None = Field(default=None)
    service: str | None = Field(default=None)
    stage: str | None = Field(default=None)
    error_type: str | None = Field(default=None, alias="errorType")
    user_id: str | None = Field(default=None, alias="userId")
    category: str | None = Field(default=None)
    user_message: str | None = Field(default=None, alias="userMessage")

    model_config = {"populate_by_name": True, "extra": "allow"}

    @property
    def effective_category(self) -> str:
        """Return the notification category, inferring it when not explicit.

        Returns:
            ``"user"`` when ``userId`` is present or ``category`` is ``"user"``;
            ``"system"`` otherwise.
        """
        if self.category in ("user", "system"):
            return self.category
        return "user" if self.user_id else "system"

    @property
    def effective_user_message(self) -> str | None:
        """Return the user-facing message, falling back to ``error``.

        Returns:
            ``userMessage`` if set; otherwise ``error``.
        """
        return self.user_message or self.error
