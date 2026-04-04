"""Pub/Sub push endpoint for the DLQ Notifier service.

Exposes ``POST /pubsub/push`` which receives Google Cloud Pub/Sub push
messages from the ``dead-letter-queue`` subscription, decodes the payload,
stores a notification record in Firestore, and dispatches an email alert
to the configured recipients.

Google Cloud Pub/Sub expects an HTTP 2xx response to acknowledge a message.
Any non-2xx response causes Pub/Sub to retry the delivery.  The endpoint
always returns 200 after processing — even when notification delivery fails —
to prevent Pub/Sub from re-delivering a message simply because the email
transport was temporarily unavailable.  Notification failures are logged at
WARNING level for operational visibility.

Malformed push envelopes (invalid JSON, missing ``message`` field, bad
base64) return 400 so that Pub/Sub does *not* retry clearly broken messages.
"""

from __future__ import annotations

from bowltie_py import format_error, format_success
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from toolbox_py import get_logger

from app.config import settings
from app.models.pubsub import DlqMessagePayload, PubSubPushEnvelope
from app.services.notification_service import NotificationService
from app.services.notification_store import NotificationStore
from app.utils.exceptions import PubSubMessageError

logger = get_logger(__name__)

router = APIRouter(tags=["Pub/Sub"])


def _get_notification_service() -> NotificationService:
    """Create a fully-wired NotificationService."""
    from hermes_py import get_messaging_service

    return NotificationService(
        messaging_service=get_messaging_service(),
        recipients=settings.notification_recipients,
    )


def _get_notification_store() -> NotificationStore:
    """Return a configured NotificationStore."""
    return NotificationStore(
        collection_name=settings.firestore_collection_notifications,
        ttl_days=settings.notification_ttl_days,
    )


@router.post(
    "/pubsub/push",
    summary="Receive a Pub/Sub push message from the dead-letter queue",
    description=(
        "Google Cloud Pub/Sub push endpoint.  Receives dead-letter messages "
        "from the ``dead-letter-queue`` subscription, extracts failure context, "
        "stores the notification in Firestore, and dispatches an email alert to "
        "the configured recipients.\n\n"
        "Always returns HTTP 200 to acknowledge the message — even when email "
        "delivery fails — to prevent infinite re-delivery loops.  Notification "
        "failures are logged at WARNING level.  Malformed push envelopes return "
        "HTTP 400 (message will not be retried by Pub/Sub)."
    ),
    responses={
        200: {"description": "Message acknowledged; notification stored and alert sent (or logged on failure)."},
        400: {"description": "Malformed Pub/Sub envelope — message will not be retried."},
    },
)
async def pubsub_push(request: Request) -> JSONResponse:
    """Handle a Google Cloud Pub/Sub push message from the dead-letter queue."""
    # --- Parse the Pub/Sub envelope ---
    try:
        body = await request.json()
        envelope = PubSubPushEnvelope.model_validate(body)
        payload_dict = envelope.message.decode_data()
    except PubSubMessageError as exc:
        logger.warning("Malformed Pub/Sub message: %s", exc)
        return JSONResponse(
            status_code=400,
            content=format_error("BAD_REQUEST", "Malformed Pub/Sub message payload."),
        )
    except Exception as exc:
        logger.warning("Failed to parse Pub/Sub push envelope: %s", exc)
        return JSONResponse(
            status_code=400,
            content=format_error("BAD_REQUEST", "Invalid Pub/Sub envelope."),
        )

    # --- Extract DLQ context (all fields optional) ---
    payload = DlqMessagePayload.model_validate(payload_dict)
    message_id = envelope.message.message_id
    publish_time = envelope.message.publish_time
    subscription = envelope.subscription

    logger.info(
        "DLQ message received",
        extra={
            "resume_id": payload.resume_id,
            "service": payload.service,
            "category": payload.effective_category,
            "user_id": payload.user_id,
            "message_id": message_id,
        },
    )

    # --- Persist notification to Firestore ---
    store = _get_notification_store()
    notification_id = store.save({
        "category": payload.effective_category,
        "userId": payload.user_id,
        "resumeId": payload.resume_id,
        "service": payload.service,
        "stage": payload.stage,
        "errorType": payload.error_type,
        "error": payload.error,
        "userMessage": payload.effective_user_message,
        "messageId": message_id,
        "subscription": subscription,
        "publishTime": publish_time,
    })

    # --- Send email notification (failures are logged, not raised) ---
    try:
        notification_svc = _get_notification_service()
        notification_svc.send_dlq_alert(
            resume_id=payload.resume_id,
            service=payload.service,
            stage=payload.stage,
            error_type=payload.error_type,
            error=payload.error,
            message_id=message_id,
            publish_time=publish_time,
            subscription=subscription,
        )
    except Exception as exc:
        logger.warning(
            "Unexpected error in notification service: %s",
            exc,
            extra={"resume_id": payload.resume_id, "message_id": message_id},
        )

    return JSONResponse(
        status_code=200,
        content=format_success({
            "resumeId": payload.resume_id,
            "messageId": message_id,
            "notificationId": notification_id,
            "category": payload.effective_category,
            "status": "acknowledged",
        }),
    )
