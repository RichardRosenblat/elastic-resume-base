"""Pub/Sub push endpoint for the AI Worker.

Receives push-delivery messages from Google Cloud Pub/Sub containing a
``resumeId``.  Triggers the AI processing pipeline and returns 204 on
success.  Non-2xx responses cause Pub/Sub to retry the delivery.

Rate limiting (``RATE_LIMIT_PER_MINUTE`` from ``config.yaml``) is applied
per-source-IP via ``slowapi``.  Correlation ID propagation is handled
globally by :class:`~toolbox.middleware.correlation_id.CorrelationIdMiddleware`.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response

from app.config import settings
from app.models.pubsub import PubSubPushEnvelope
from app.rate_limit import limiter
from app.services.ai_worker_service import AIWorkerService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pubsub", tags=["pubsub"])


def _get_worker_service(request: Request) -> AIWorkerService:
    """Return the AIWorkerService instance stored on the application state."""
    return request.app.state.worker_service  # type: ignore[no-any-return]


@router.post(
    "/push",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
    summary="Receive a Pub/Sub push message",
    description=(
        "Cloud Pub/Sub push endpoint.  Receives a ``resume-extracted`` event "
        "containing a ``resumeId``, triggers the AI processing pipeline, "
        "and returns 204 on success.  Non-2xx causes Pub/Sub to retry."
    ),
)
@limiter.limit(lambda: f"{settings.rate_limit_per_minute}/minute")
async def pubsub_push(
    request: Request,
    envelope: PubSubPushEnvelope,
    worker_service: AIWorkerService = Depends(_get_worker_service),
) -> None:
    """Handle an inbound Pub/Sub push message.

    Args:
        request: The incoming HTTP request (required by slowapi for rate limiting).
        envelope: The decoded Pub/Sub push envelope.
        worker_service: The AI worker pipeline service (injected via DI).
    """
    try:
        payload = envelope.message.decode_data()
    except ValueError as exc:
        logger.error("Invalid Pub/Sub message payload: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid message payload: {exc}",
        ) from exc

    resume_id: str | None = payload.get("resumeId")
    if not resume_id:
        logger.error("Pub/Sub message missing resumeId field.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message payload must contain 'resumeId'.",
        )

    logger.info("Received Pub/Sub push message", extra={"resume_id": resume_id})

    try:
        await worker_service.process(resume_id)
    except Exception as exc:
        logger.error(
            "Processing failed for resume",
            extra={"resume_id": resume_id, "error": str(exc)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Resume processing failed.",
        ) from exc
