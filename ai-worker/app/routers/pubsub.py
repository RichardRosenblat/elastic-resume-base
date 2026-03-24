"""FastAPI router for Pub/Sub push endpoint.

Cloud Pub/Sub delivers messages to this endpoint via HTTP push.  The router
decodes the base64-encoded payload, extracts the ``resumeId``, and hands off
to :class:`~app.services.ai_worker_service.AIWorkerService` for processing.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response

from app.models.pubsub import PubSubPushEnvelope
from app.services.ai_worker_service import AIWorkerService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pubsub", tags=["pubsub"])


def _get_worker_service(request: Request) -> AIWorkerService:
    """Retrieve the :class:`~app.services.ai_worker_service.AIWorkerService`
    instance stored on the application state.

    Args:
        request: The incoming FastAPI request (injected automatically).

    Returns:
        The :class:`~app.services.ai_worker_service.AIWorkerService` singleton.
    """
    return request.app.state.worker_service  # type: ignore[no-any-return]


@router.post(
    "/push",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
    summary="Receive a Pub/Sub push message",
    description=(
        "Cloud Pub/Sub push endpoint.  Receives an ingest event containing a "
        "``resumeId``, triggers the AI processing pipeline, and returns 204 on "
        "success.  Returning a non-2xx status causes Pub/Sub to retry delivery."
    ),
)
async def pubsub_push(
    envelope: PubSubPushEnvelope,
    worker_service: AIWorkerService = Depends(_get_worker_service),
) -> None:
    """Handle an inbound Pub/Sub push message.

    Args:
        envelope: The decoded Pub/Sub push envelope.
        worker_service: The AI worker pipeline service (injected via DI).

    Raises:
        HTTPException: 400 if the message payload is missing ``resumeId``.
        HTTPException: 500 if the processing pipeline raises an unrecoverable error.
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
        # The error has already been persisted and a DLQ alert sent by the
        # service layer.  Return 500 so that Pub/Sub does NOT acknowledge the
        # message — it will be retried or forwarded to the DLQ.
        logger.error(
            "Processing failed for resume",
            extra={"resume_id": resume_id, "error": str(exc)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Resume processing failed.",
        ) from exc
