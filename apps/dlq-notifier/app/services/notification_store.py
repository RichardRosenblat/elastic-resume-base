"""Firestore-backed notification store for the DLQ Notifier service.

Provides CRUD operations for persisting, querying, and managing DLQ
notification records in a Firestore collection.  All methods are
best-effort — failures are logged at WARNING level and do not propagate
so that the DLQ push endpoint can always acknowledge messages.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from toolbox_py import get_logger

from app.models.notification import NotificationRecord

logger = get_logger(__name__)

# Maximum look-back window for user notification queries (24 hours).
_MAX_LOOKBACK_HOURS = 24

# Limit applied to all list queries to protect against memory exhaustion.
_DEFAULT_LIMIT = 50
_MAX_LIMIT = 200


def _utcnow_iso() -> str:
    return (
        datetime.now(tz=UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


class NotificationStore:
    """Manages DLQ notification records in a Firestore collection.

    Args:
        collection_name: Name of the Firestore collection.
        ttl_days: Maximum age in days before notifications are auto-deleted.
    """

    def __init__(self, collection_name: str, ttl_days: int = 30) -> None:
        """Initialise the notification store.

        Args:
            collection_name: Firestore collection name.
            ttl_days: Notifications older than this many days are pruned.
        """
        self._collection = collection_name
        self._ttl_days = ttl_days

    def _get_collection(self) -> Any:
        """Return the Firestore collection reference.

        Returns:
            A Firestore CollectionReference.

        Raises:
            RuntimeError: If Firebase Admin has not been initialised.
        """
        from firebase_admin import firestore  # type: ignore[import-untyped]

        return firestore.client().collection(self._collection)

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def save(self, record: dict[str, Any]) -> str:
        """Persist a notification record to Firestore.

        Generates a new document ID, sets ``createdAt`` if absent, and writes
        the document.

        Args:
            record: Dictionary of notification fields (no ``id`` key required).

        Returns:
            The Firestore document ID that was created.
        """
        try:
            col = self._get_collection()
            record.setdefault("createdAt", _utcnow_iso())
            record.setdefault("read", False)
            doc_ref = col.document()
            doc_ref.set(record)
            doc_id: str = doc_ref.id
            logger.debug(
                "Notification saved",
                extra={"notification_id": doc_id, "category": record.get("category")},
            )
            return doc_id
        except Exception as exc:
            logger.warning("Failed to save notification: %s", exc)
            return ""

    def mark_read(self, notification_id: str, user_id: str | None = None) -> bool:
        """Mark a notification as read.

        When ``user_id`` is provided the update is only applied if the
        document's ``userId`` field matches, preventing users from marking
        each other's notifications as read.

        Args:
            notification_id: Firestore document ID of the notification.
            user_id: Optional UID for ownership verification.

        Returns:
            ``True`` if the update was applied; ``False`` on error or mismatch.
        """
        try:
            col = self._get_collection()
            doc_ref = col.document(notification_id)
            doc = doc_ref.get()
            if not doc.exists:
                return False
            data = doc.to_dict() or {}
            if user_id and data.get("userId") != user_id:
                return False
            doc_ref.update({"read": True})
            return True
        except Exception as exc:
            logger.warning(
                "Failed to mark notification as read: %s",
                exc,
                extra={"notification_id": notification_id},
            )
            return False

    def delete(self, notification_id: str, user_id: str | None = None) -> bool:
        """Delete a notification document.

        When ``user_id`` is provided the deletion is only performed if the
        document's ``userId`` matches (or ``category`` is ``"user"`` for the
        requesting user).

        Args:
            notification_id: Firestore document ID.
            user_id: Optional UID for ownership verification.

        Returns:
            ``True`` if deleted; ``False`` on error or ownership mismatch.
        """
        try:
            col = self._get_collection()
            doc_ref = col.document(notification_id)
            doc = doc_ref.get()
            if not doc.exists:
                return False
            data = doc.to_dict() or {}
            if user_id and data.get("userId") != user_id:
                return False
            doc_ref.delete()
            return True
        except Exception as exc:
            logger.warning(
                "Failed to delete notification: %s",
                exc,
                extra={"notification_id": notification_id},
            )
            return False

    def delete_old_notifications(self) -> int:
        """Delete notifications older than ``ttl_days``.

        Returns:
            Number of documents deleted (0 on error).
        """
        cutoff = datetime.now(tz=UTC) - timedelta(days=self._ttl_days)
        cutoff_iso = cutoff.isoformat(timespec="milliseconds").replace("+00:00", "Z")
        try:
            col = self._get_collection()
            old_docs = col.where("createdAt", "<", cutoff_iso).stream()
            count = 0
            for doc in old_docs:
                doc.reference.delete()
                count += 1
            if count:
                logger.info("Pruned %d old notifications (TTL=%d days)", count, self._ttl_days)
            return count
        except Exception as exc:
            logger.warning("Failed to prune old notifications: %s", exc)
            return 0

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def get_user_notifications(
        self,
        user_id: str,
        since: datetime | None = None,
        limit: int = _DEFAULT_LIMIT,
    ) -> list[NotificationRecord]:
        """Return user-letter notifications for a specific user.

        Limits look-back to the last 24 hours regardless of ``since``.

        Args:
            user_id: Firebase UID of the recipient.
            since: Only return notifications created after this timestamp.
                Clamped to at most 24 hours ago.
            limit: Maximum number of records to return.

        Returns:
            List of :class:`~app.models.notification.NotificationRecord`
            objects ordered by ``createdAt`` descending.
        """
        earliest = datetime.now(tz=UTC) - timedelta(hours=_MAX_LOOKBACK_HOURS)
        if since is None or since < earliest:
            since = earliest
        since_iso = since.isoformat(timespec="milliseconds").replace("+00:00", "Z")
        cap = min(limit, _MAX_LIMIT)
        try:
            col = self._get_collection()
            query = (
                col.where("userId", "==", user_id)
                .where("category", "==", "user")
                .where("createdAt", ">", since_iso)
                .order_by("createdAt", direction="DESCENDING")
                .limit(cap)
            )
            return self._docs_to_records(query.stream())
        except Exception as exc:
            logger.warning("Failed to query user notifications: %s", exc)
            return []

    def get_system_notifications(
        self,
        since: datetime | None = None,
        limit: int = _DEFAULT_LIMIT,
        service: str | None = None,
        stage: str | None = None,
        read: bool | None = None,
    ) -> list[NotificationRecord]:
        """Return system-letter notifications for administrators.

        Args:
            since: Only return notifications created after this timestamp.
            limit: Maximum number of records to return.
            service: Optional filter by originating service name.
            stage: Optional filter by pipeline stage.
            read: When set, filter by read/unread status.

        Returns:
            List of :class:`~app.models.notification.NotificationRecord`
            objects ordered by ``createdAt`` descending.
        """
        cap = min(limit, _MAX_LIMIT)
        since_iso: str | None = None
        if since is not None:
            since_iso = since.isoformat(timespec="milliseconds").replace("+00:00", "Z")
        try:
            col = self._get_collection()
            query = col.where("category", "==", "system")
            if since_iso:
                query = query.where("createdAt", ">", since_iso)
            if service:
                query = query.where("service", "==", service)
            if stage:
                query = query.where("stage", "==", stage)
            if read is not None:
                query = query.where("read", "==", read)
            query = query.order_by("createdAt", direction="DESCENDING").limit(cap)
            return self._docs_to_records(query.stream())
        except Exception as exc:
            logger.warning("Failed to query system notifications: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _docs_to_records(docs: Any) -> list[NotificationRecord]:
        """Convert a Firestore document stream to a list of records."""
        results: list[NotificationRecord] = []
        for doc in docs:
            data: dict[str, Any] = doc.to_dict() or {}
            data["id"] = doc.id
            try:
                results.append(
                    NotificationRecord(
                        id=data.get("id", ""),
                        category=data.get("category", "system"),
                        user_id=data.get("userId"),
                        resume_id=data.get("resumeId"),
                        service=data.get("service"),
                        stage=data.get("stage"),
                        error_type=data.get("errorType"),
                        error=data.get("error"),
                        user_message=data.get("userMessage"),
                        message_id=data.get("messageId", ""),
                        subscription=data.get("subscription", ""),
                        publish_time=data.get("publishTime", ""),
                        created_at=data.get("createdAt", ""),
                        read=data.get("read", False),
                    )
                )
            except Exception as exc:
                logger.warning("Failed to parse notification document: %s", exc)
        return results
