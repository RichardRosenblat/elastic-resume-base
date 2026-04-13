"""Pub/Sub push endpoint for the AI Worker service.

Exposes ``POST /api/v1/pubsub/push`` which receives Google Cloud Pub/Sub push
messages from the ``resume-ingested`` subscription, decodes the payload, and
hands off to :class:`~app.services.ai_worker_service.AIWorkerService` for
processing.

Google Cloud Pub/Sub expects an HTTP 2xx response to acknowledge a message.
Any non-2xx response causes Pub/Sub to retry the delivery.  The endpoint
therefore returns 200 for both successful processing *and* permanent errors
(e.g. document not found, malformed payload) after publishing to the DLQ —
this prevents infinite retry loops for errors that can never be resolved.
Transient errors (e.g. Vertex AI temporarily unavailable) return 500 to
request a retry from Pub/Sub.
"""

from __future__ import annotations

from bowltie_py import format_error, format_success
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from synapse_py import FirestoreResumeStore, SynapseNotFoundError, initialize_persistence
from toolbox_py import get_logger

from app.config import settings
from app.models.pubsub import PubSubPushEnvelope, ResumeIngestedPayload
from app.services.ai_worker_service import AIWorkerService
from app.services.vertex_ai_service import VertexAIService
from app.utils.exceptions import (
    EmbeddingError,
    ExtractionError,
    PubSubMessageError,
)

logger = get_logger(__name__)

router = APIRouter(tags=["Pub/Sub"])


def _get_ai_worker_service() -> AIWorkerService:
    """Create a fully-wired :class:`~app.services.ai_worker_service.AIWorkerService`.

    Initialises Synapse (Firestore) and Vertex AI, then assembles the service
    with a Hermes publisher and the configured collection/topic names.

    Returns:
        A configured :class:`~app.services.ai_worker_service.AIWorkerService`.
    """
    from hermes_py import get_publisher

    initialize_persistence(
        project_id=settings.gcp_project_id or "demo-project",
    )

    vertex_ai_svc = VertexAIService(
        project_id=settings.gcp_project_id or "demo-project",
        location=settings.vertex_ai_location,
        extraction_model=settings.vertex_ai_extraction_model,
        embedding_model=settings.vertex_ai_embedding_model,
    )
    vertex_ai_svc.initialize()

    return AIWorkerService(
        resume_store=FirestoreResumeStore(settings.firestore_collection_resumes),
        vertex_ai_service=vertex_ai_svc,
        publisher=get_publisher(),
        embeddings_collection=settings.firestore_collection_embeddings,
        topic_resume_indexed=settings.pubsub_topic_resume_indexed,
        topic_dlq=settings.pubsub_topic_dlq,
        encrypt_kms_key_name=settings.encrypt_kms_key_name,
        encrypt_local_key=settings.encrypt_local_key,
    )


@router.post(
    "/pubsub/push",
    summary="Receive a Pub/Sub push message for resume processing",
    description=(
        "Google Cloud Pub/Sub push endpoint.  Receives ``{ resumeId }`` messages "
        "from the ``resume-ingested`` subscription, extracts structured fields and "
        "generates embedding vectors using Vertex AI, persists the results to "
        "Firestore, and publishes to the ``resume-indexed`` topic.\n\n"
        "Returns HTTP 200 to acknowledge the message (even for permanent errors, "
        "which are forwarded to the DLQ).  Returns HTTP 500 for transient errors "
        "to request a Pub/Sub retry."
    ),
    responses={
        200: {"description": "Message processed or permanently failed (sent to DLQ)."},
        400: {"description": "Malformed Pub/Sub envelope — message will not be retried."},
        500: {"description": "Transient processing error — Pub/Sub will retry."},
    },
)
async def pubsub_push(request: Request) -> JSONResponse:
    """Handle a Google Cloud Pub/Sub push message.

    Decodes the base64 message payload, extracts the ``resumeId``, and runs
    the AI processing pipeline.

    Permanent failures (bad payload, document not found) are acknowledged and
    forwarded to the DLQ to avoid infinite retry loops.  Transient failures
    (Vertex AI errors, unexpected exceptions) return 500 so that Pub/Sub
    retries the message up to the configured ``max_delivery_attempts`` before
    routing it to the DLQ.

    Args:
        request: The incoming HTTP request from Google Cloud Pub/Sub.

    Returns:
        JSONResponse with a Bowltie-formatted payload indicating the outcome.
    """
    # --- Parse the Pub/Sub envelope ---
    try:
        body = await request.json()
        envelope = PubSubPushEnvelope.model_validate(body)
        payload_dict = envelope.message.decode_data()
        payload = ResumeIngestedPayload.model_validate(payload_dict)
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

    resume_id = payload.resume_id
    message_id = envelope.message.message_id
    logger.info(
        "Pub/Sub message received",
        extra={"resume_id": resume_id, "message_id": message_id},
    )

    # --- Run the processing pipeline ---
    try:
        service = _get_ai_worker_service()
        service.process_resume(resume_id)
    except SynapseNotFoundError as exc:
        # Permanent error — the document does not exist and never will.
        logger.error(
            "Resume not found — sending to DLQ",
            extra={"resume_id": resume_id, "error": str(exc)},
        )
        # Acknowledge the message (return 200) to stop Pub/Sub retrying.
        return JSONResponse(
            status_code=200,
            content=format_error("NOT_FOUND", "Resume document not found."),
        )
    except (ExtractionError, EmbeddingError) as exc:
        # Vertex AI errors are transient — return 500 to request retry.
        logger.error(
            "Vertex AI error during processing",
            extra={"resume_id": resume_id, "error": str(exc)},
        )
        return JSONResponse(
            status_code=500,
            content=format_error("VERTEX_AI_ERROR", "Vertex AI processing failed. Retrying."),
        )
    except Exception as exc:
        # Unexpected error — return 500 to request retry.
        logger.exception(
            "Unexpected error during resume processing",
            extra={"resume_id": resume_id},
        )
        return JSONResponse(
            status_code=500,
            content=format_error("INTERNAL_ERROR", "An unexpected error occurred. Retrying."),
        )

    logger.info(
        "Resume processed successfully",
        extra={"resume_id": resume_id},
    )
    return JSONResponse(
        status_code=200,
        content=format_success({"resumeId": resume_id, "status": "processed"}),
    )
