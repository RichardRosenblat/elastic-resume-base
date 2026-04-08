"""Email notification service for DLQ failure alerts."""

from __future__ import annotations

from hermes_py import IMessagingService, Message
from toolbox_py import get_logger

logger = get_logger(__name__)

_EMAIL_SUBJECT = "DLQ Alert: Failed message in dead-letter-queue"

_EMAIL_BODY_TEMPLATE = """\
A message has been routed to the dead-letter queue after exhausting its \
maximum delivery attempts.  Manual investigation and re-processing may be required.

--- Failure Details ---
Resume ID  : {resume_id}
Service    : {service}
Stage      : {stage}
Error Type : {error_type}
Error      : {error}
Message ID : {message_id}
Published  : {publish_time}
Subscription: {subscription}
-----------------------

Please investigate the failure and re-publish the message to the appropriate
topic if a retry is warranted.
"""


class NotificationService:
    """Sends email alerts for DLQ failure messages.

    Uses the injected :class:`~hermes_py.interfaces.messaging_service.IMessagingService`
    to deliver notifications so that the underlying transport (SMTP, etc.) can
    be swapped or mocked in tests without changing this class.

    Args:
        messaging_service: The messaging transport to use for delivery.
        recipients: One or more email addresses that will receive the alert.
    """

    def __init__(
        self,
        messaging_service: IMessagingService,
        recipients: list[str],
    ) -> None:
        """Initialise the notification service.

        Args:
            messaging_service: Messaging transport (e.g. SMTP) for delivery.
            recipients: List of email addresses to notify on each DLQ event.
        """
        self._messaging = messaging_service
        self._recipients = recipients

    def send_dlq_alert(
        self,
        *,
        resume_id: str | None,
        service: str | None,
        stage: str | None,
        error_type: str | None,
        error: str | None,
        message_id: str,
        publish_time: str,
        subscription: str,
    ) -> None:
        """Send an email alert for a single DLQ failure event.

        Formats a plain-text email with all available failure context and
        dispatches it to all configured recipients.  Delivery failures are
        logged at WARNING level and do not propagate — the Pub/Sub endpoint
        must always return 200 (acknowledge) regardless of notification outcome
        to avoid re-delivery loops.

        Args:
            resume_id: Firestore document ID of the failed resume, if known.
            service: Name of the upstream service that produced the failure.
            stage: Processing stage at which the failure occurred, if known.
            error_type: Machine-readable error category, if known.
            error: Human-readable error description, if known.
            message_id: Pub/Sub message ID from the push envelope.
            publish_time: ISO-8601 publish timestamp from the push envelope.
            subscription: Fully-qualified Pub/Sub subscription name.
        """
        body = _EMAIL_BODY_TEMPLATE.format(
            resume_id=resume_id or "(unknown)",
            service=service or "(unknown)",
            stage=stage or "(unknown)",
            error_type=error_type or "(unknown)",
            error=error or "(unknown)",
            message_id=message_id or "(unknown)",
            publish_time=publish_time or "(unknown)",
            subscription=subscription or "(unknown)",
        )
        message = Message(
            to=self._recipients,
            subject=_EMAIL_SUBJECT,
            body=body,
        )
        try:
            self._messaging.send(message)
            logger.info(
                "DLQ alert sent",
                extra={
                    "resume_id": resume_id,
                    "service": service,
                    "message_id": message_id,
                    "recipients": len(self._recipients),
                },
            )
        except Exception as exc:
            logger.warning(
                "Failed to send DLQ alert: %s",
                exc,
                extra={
                    "resume_id": resume_id,
                    "service": service,
                    "message_id": message_id,
                },
            )
