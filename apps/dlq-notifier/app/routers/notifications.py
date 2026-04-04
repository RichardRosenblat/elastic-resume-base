"""REST API endpoints for reading and managing DLQ notifications.

These endpoints are proxied by the Gateway API.  The Gateway verifies the
Firebase ID token and injects ``X-User-Id`` and ``X-User-Role`` headers so
this service does not need to perform its own token verification.

Endpoints:
    ``GET  /api/v1/notifications``                  — User's own notifications
    ``GET  /api/v1/notifications/system``            — System notifications (admin)
    ``PATCH /api/v1/notifications/{id}/read``        — Mark notification as read
    ``DELETE /api/v1/notifications/{id}``            — Delete notification
"""

from __future__ import annotations

from datetime import UTC, datetime

from bowltie_py import format_error, format_success
from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import JSONResponse
from toolbox_py import get_logger

from app.config import settings
from app.models.notification import NotificationListResponse
from app.services.notification_store import NotificationStore

logger = get_logger(__name__)

router = APIRouter(tags=["Notifications"])

_24H_SECONDS = 86_400


def _get_store() -> NotificationStore:
    """Return a configured :class:`~app.services.notification_store.NotificationStore`.

    Returns:
        A store wired to the configured Firestore collection and TTL.
    """
    return NotificationStore(
        collection_name=settings.firestore_collection_notifications,
        ttl_days=settings.notification_ttl_days,
    )


def _parse_since(since_raw: str | None) -> datetime | None:
    """Parse an optional ISO-8601 ``since`` timestamp.

    Args:
        since_raw: Raw query-parameter string, or ``None``.

    Returns:
        Parsed :class:`datetime` (UTC) or ``None`` when the string is absent
        or cannot be parsed.
    """
    if not since_raw:
        return None
    try:
        dt = datetime.fromisoformat(since_raw.rstrip("Z"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt
    except ValueError:
        return None


@router.get(
    "/notifications",
    summary="List the calling user's DLQ notifications",
    description=(
        "Returns user-letter DLQ notifications addressed to the calling user. "
        "Supports a ``since`` query parameter (ISO-8601) to fetch only new "
        "notifications since the last poll.  The look-back window is capped at "
        "the last 24 hours regardless of ``since``.  Requires ``X-User-Id`` "
        "header (injected by the Gateway API)."
    ),
)
async def list_notifications(
    _request: Request,
    since: str | None = Query(default=None, description="ISO-8601 timestamp; only return notifications after this time"),
    limit: int = Query(default=50, ge=1, le=200, description="Maximum number of notifications to return"),
    x_user_id: str | None = Header(default=None, alias="x-user-id"),
    x_user_role: str | None = Header(default=None, alias="x-user-role"),
) -> JSONResponse:
    """Return user-letter notifications for the authenticated caller.

    Args:
        _request: The incoming HTTP request (unused directly).
        since: Optional ISO-8601 timestamp for incremental polling.
        limit: Maximum number of records (capped at 200).
        x_user_id: Firebase UID injected by the Gateway API.
        x_user_role: User role injected by the Gateway API.

    Returns:
        JSONResponse with a Bowltie-formatted list of notifications.
    """
    if not x_user_id:
        return JSONResponse(
            status_code=401,
            content=format_error("UNAUTHORIZED", "X-User-Id header is required."),
        )

    since_dt = _parse_since(since)
    store = _get_store()

    # Admins can request system notifications via this endpoint too; they always
    # see their own user notifications when calling this endpoint.
    records = store.get_user_notifications(
        user_id=x_user_id,
        since=since_dt,
        limit=limit,
    )

    response = NotificationListResponse(
        notifications=records,
        total=len(records),
    )
    return JSONResponse(format_success(response.model_dump()))


@router.get(
    "/notifications/system",
    summary="List system-letter DLQ notifications (admin only)",
    description=(
        "Returns system-level DLQ notifications for administrators.  "
        "Supports ``since``, ``limit``, ``service``, ``stage``, and ``unread`` "
        "query parameters.  Requires ``X-User-Role: admin`` (injected by Gateway API)."
    ),
)
async def list_system_notifications(
    _request: Request,
    since: str | None = Query(default=None, description="ISO-8601 timestamp; only return notifications after this time"),
    limit: int = Query(default=50, ge=1, le=200, description="Maximum number of notifications to return"),
    service: str | None = Query(default=None, description="Filter by originating service"),
    stage: str | None = Query(default=None, description="Filter by pipeline stage"),
    unread: bool | None = Query(default=None, description="When true, return only unread notifications"),
    x_user_role: str | None = Header(default=None, alias="x-user-role"),
) -> JSONResponse:
    """Return system-letter notifications.  Admin-only endpoint.

    Args:
        _request: The incoming HTTP request.
        since: Optional ISO-8601 timestamp.
        limit: Maximum number of records.
        service: Service name filter.
        stage: Pipeline stage filter.
        unread: Filter by unread status.
        x_user_role: User role injected by the Gateway API.

    Returns:
        JSONResponse with a Bowltie-formatted list of system notifications.
    """
    if x_user_role != "admin":
        return JSONResponse(
            status_code=403,
            content=format_error("FORBIDDEN", "System notifications are accessible to admins only."),
        )

    since_dt = _parse_since(since)
    store = _get_store()
    records = store.get_system_notifications(
        since=since_dt,
        limit=limit,
        service=service,
        stage=stage,
        # `unread=True` means return unread notifications, so `read=False`.
        # When `unread` is None we pass None (no read-status filter applied).
        read=None if unread is None else (not unread),
    )

    response = NotificationListResponse(
        notifications=records,
        total=len(records),
    )
    return JSONResponse(format_success(response.model_dump()))


@router.patch(
    "/notifications/{notification_id}/read",
    summary="Mark a notification as read",
    description=(
        "Marks the specified notification as read.  Users may only mark their "
        "own user-letter notifications as read.  Admins may mark any "
        "notification.  Requires ``X-User-Id`` header."
    ),
)
async def mark_notification_read(
    notification_id: str,
    _request: Request,
    x_user_id: str | None = Header(default=None, alias="x-user-id"),
    x_user_role: str | None = Header(default=None, alias="x-user-role"),
) -> JSONResponse:
    """Mark a notification document as read.

    Args:
        notification_id: Firestore document ID of the notification.
        _request: The incoming HTTP request.
        x_user_id: Firebase UID injected by the Gateway API.
        x_user_role: User role injected by the Gateway API.

    Returns:
        JSONResponse indicating success or failure.
    """
    if not x_user_id:
        return JSONResponse(
            status_code=401,
            content=format_error("UNAUTHORIZED", "X-User-Id header is required."),
        )

    store = _get_store()
    # Admins can mark any notification; regular users are scoped to their own.
    owner_id = None if x_user_role == "admin" else x_user_id
    updated = store.mark_read(notification_id=notification_id, user_id=owner_id)

    if not updated:
        return JSONResponse(
            status_code=404,
            content=format_error("NOT_FOUND", "Notification not found or access denied."),
        )

    return JSONResponse(format_success({"id": notification_id, "read": True}))


@router.delete(
    "/notifications/{notification_id}",
    summary="Delete a notification",
    description=(
        "Permanently deletes the specified notification.  Users may only delete "
        "their own user-letter notifications.  Admins may delete any notification. "
        "Requires ``X-User-Id`` header."
    ),
)
async def delete_notification(
    notification_id: str,
    _request: Request,
    x_user_id: str | None = Header(default=None, alias="x-user-id"),
    x_user_role: str | None = Header(default=None, alias="x-user-role"),
) -> JSONResponse:
    """Permanently delete a notification document.

    Args:
        notification_id: Firestore document ID of the notification.
        _request: The incoming HTTP request.
        x_user_id: Firebase UID injected by the Gateway API.
        x_user_role: User role injected by the Gateway API.

    Returns:
        JSONResponse indicating success or failure.
    """
    if not x_user_id:
        return JSONResponse(
            status_code=401,
            content=format_error("UNAUTHORIZED", "X-User-Id header is required."),
        )

    store = _get_store()
    owner_id = None if x_user_role == "admin" else x_user_id
    deleted = store.delete(notification_id=notification_id, user_id=owner_id)

    if not deleted:
        return JSONResponse(
            status_code=404,
            content=format_error("NOT_FOUND", "Notification not found or access denied."),
        )

    return JSONResponse(format_success({"id": notification_id, "deleted": True}))
