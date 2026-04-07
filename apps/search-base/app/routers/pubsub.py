"""Pub/Sub push endpoint for the Search Base service.

Exposes ``POST /api/v1/pubsub/push`` which receives Google Cloud Pub/Sub push
messages from the ``resume-indexed`` subscription, fetches the embedding from
Firestore, and adds it to the FAISS index.

Google Cloud Pub/Sub expects an HTTP 2xx response to acknowledge a message.
Any non-2xx response causes Pub/Sub to retry the delivery.  The endpoint
therefore returns 200 for both successful processing *and* permanent errors
(e.g. embedding not found, malformed payload) — this prevents infinite retry
loops for errors that can never be resolved.  Transient errors (e.g. Firestore
temporarily unavailable) return 500 to request a retry from Pub/Sub.
"""

from __future__ import annotations

from bowltie_py import format_error, format_success
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from firebase_admin import firestore
from toolbox_py import get_logger

from app.config import settings
from app.dependencies import get_search_service
from app.models.pubsub import PubSubPushEnvelope, ResumeIndexedPayload
from app.utils.exceptions import FaissIndexError, PubSubMessageError

logger = get_logger(__name__)

router = APIRouter(tags=["Pub/Sub"])


@router.post(
    "/pubsub/push",
    summary="Receive a Pub/Sub push message for resume indexing",
    description=(
        "Google Cloud Pub/Sub push endpoint.  Receives ``{ resumeId }`` messages "
        "from the ``resume-indexed`` subscription, fetches the embedding from "
        "Firestore, and adds it to the FAISS index.\n\n"
        "Returns HTTP 200 to acknowledge the message (even for permanent errors, "
        "which are logged).  Returns HTTP 500 for transient errors to request a "
        "Pub/Sub retry."
    ),
    responses={
        200: {"description": "Message processed or permanently failed."},
        400: {"description": "Malformed Pub/Sub envelope — message will not be retried."},
        500: {"description": "Transient processing error — Pub/Sub will retry."},
    },
)
async def pubsub_push(request: Request) -> JSONResponse:
    """Handle a Google Cloud Pub/Sub push message.

    Decodes the base64 message payload, extracts the ``resumeId``, fetches
    the embedding from Firestore, and adds it to the FAISS index.

    Permanent failures (bad payload, embedding not found) are acknowledged and
    logged to avoid infinite retry loops.  Transient failures (Firestore
    errors, unexpected exceptions) return 500 so that Pub/Sub retries the
    message up to the configured ``max_delivery_attempts``.

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
        payload = ResumeIndexedPayload.model_validate(payload_dict)
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

    # --- Fetch embedding from Firestore and add to index ---
    try:
        service = get_search_service()
        db = firestore.client()

        # Fetch embedding document
        embeddings_ref = db.collection(settings.firestore_collection_embeddings)
        doc = embeddings_ref.document(resume_id).get()

        if not doc.exists:
            # Permanent error — embedding was never created
            logger.error(
                "Embedding not found for resume",
                extra={"resume_id": resume_id},
            )
            # Acknowledge the message (return 200) to stop Pub/Sub retrying
            return JSONResponse(
                status_code=200,
                content=format_error("NOT_FOUND", "Embedding document not found."),
            )

        data = doc.to_dict()
        embedding = data.get("fullTextEmbedding")

        if not embedding:
            # Permanent error — embedding field is missing
            logger.error(
                "Missing fullTextEmbedding field",
                extra={"resume_id": resume_id},
            )
            return JSONResponse(
                status_code=200,
                content=format_error("INVALID_DATA", "Missing fullTextEmbedding field."),
            )

        # Add to FAISS index
        service.add_resume_embedding(resume_id, embedding)

        # Save index to disk if configured
        if settings.faiss_index_path:
            service.save_to_disk()

    except FaissIndexError as exc:
        # FAISS errors could be transient (e.g. disk write failure)
        logger.error(
            "FAISS index error during processing",
            extra={"resume_id": resume_id, "error": str(exc)},
        )
        return JSONResponse(
            status_code=500,
            content=format_error("INDEX_ERROR", "FAISS index error. Retrying."),
        )
    except Exception as exc:
        # Unexpected error — return 500 to request retry
        logger.exception(
            "Unexpected error during resume indexing",
            extra={"resume_id": resume_id},
        )
        return JSONResponse(
            status_code=500,
            content=format_error("INTERNAL_ERROR", "An unexpected error occurred. Retrying."),
        )

    logger.info(
        "Resume indexed successfully",
        extra={"resume_id": resume_id},
    )
    return JSONResponse(
        status_code=200,
        content=format_success({"resumeId": resume_id, "status": "indexed"}),
    )
