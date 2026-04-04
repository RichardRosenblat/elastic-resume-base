"""Pydantic models for DLQ notifications."""

from __future__ import annotations

from pydantic import BaseModel, Field


class NotificationRecord(BaseModel):
    """A persisted DLQ notification record.

    Attributes:
        id: Auto-generated Firestore document ID.
        category: ``"user"`` for user-caused failures; ``"system"`` for
            infrastructure failures.
        user_id: Firebase UID of the affected user, or ``None`` for system
            notifications.
        resume_id: Firestore document ID of the failed resume, if known.
        service: Name of the upstream service that produced the failure.
        stage: Processing stage at which the failure occurred.
        error_type: Machine-readable error category.
        error: Technical error description (shown to admins).
        user_message: User-friendly error description (shown to users).
        message_id: Pub/Sub message ID.
        subscription: Fully-qualified Pub/Sub subscription name.
        publish_time: ISO-8601 publish timestamp from Pub/Sub.
        created_at: ISO-8601 timestamp when the notification was stored.
        read: Whether the recipient has viewed the notification.
    """

    id: str = Field(default="")
    category: str = Field(default="system")
    user_id: str | None = Field(default=None)
    resume_id: str | None = Field(default=None)
    service: str | None = Field(default=None)
    stage: str | None = Field(default=None)
    error_type: str | None = Field(default=None)
    error: str | None = Field(default=None)
    user_message: str | None = Field(default=None)
    message_id: str = Field(default="")
    subscription: str = Field(default="")
    publish_time: str = Field(default="")
    created_at: str = Field(default="")
    read: bool = Field(default=False)


class NotificationListResponse(BaseModel):
    """Response envelope for notification list endpoints.

    Attributes:
        notifications: List of notification records.
        total: Total number of records returned.
    """

    notifications: list[NotificationRecord]
    total: int
