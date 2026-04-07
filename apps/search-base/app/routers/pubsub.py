"""Pub/Sub push endpoint for the Search Base service.

Exposes ``POST /api/v1/pubsub/push`` which receives Google Cloud Pub/Sub push
messages from the ``resume-indexed`` subscription, fetches all embedding
vectors from Firestore (full-text, skills, and any other field-level
embeddings), and adds them to the FAISS index.  After a successful update the
index is persisted to disk and the resume document in Firestore is marked as
indexed (via a ``metadata.searchIndexInfo.faissIndexedAt`` field) to prevent
duplicate processing on service restart.

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
        "from the ``resume-indexed`` subscription, fetches all embedding vectors "
        "(full-text, skills, and any other field-level embeddings) from Firestore, "
        "and adds them to the FAISS index.  The index is persisted to disk and the "
        "resume is marked as indexed in Firestore after a successful update.\n\n"
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
    all embedding vectors from Firestore, and adds them to the FAISS index.

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

    # --- Fetch embeddings from Firestore and add to index ---
    try:
        service = get_search_service()
        db = firestore.client()

        # Fetch embedding document from the embeddings collection.
        embeddings_ref = db.collection(settings.firestore_collection_embeddings)
        doc = embeddings_ref.document(resume_id).get()

        if not doc.exists:
            # Permanent error — embedding was never created.
            logger.error(
                "Embedding document not found for resume",
                extra={"resume_id": resume_id},
            )
            # Acknowledge the message (return 200) to stop Pub/Sub retrying.
            return JSONResponse(
                status_code=200,
                content=format_error("NOT_FOUND", "Embedding document not found."),
            )

        data = doc.to_dict() or {}

        # Collect ALL embedding vectors stored in this document.
        # The AI Worker stores at least "fullTextEmbedding" and "skillsEmbedding".
        # Future field-level embeddings are picked up automatically because we
        # look for any key ending with "Embedding".
        from app.services.search_service import _embedding_field_to_type

        embeddings: dict[str, list[float]] = {}
        for field_name, value in data.items():
            if field_name.endswith("Embedding") and isinstance(value, list) and len(value) > 0:
                embedding_type = _embedding_field_to_type(field_name)
                embeddings[embedding_type] = value

        if not embeddings:
            # Permanent error — no usable embedding fields present.
            logger.error(
                "No embedding vectors found in document",
                extra={"resume_id": resume_id},
            )
            return JSONResponse(
                status_code=200,
                content=format_error("INVALID_DATA", "No embedding vectors found."),
            )

        # Add all embedding types to the FAISS index.  The service handles
        # deduplication and marks the resume as indexed in Firestore.
        vectors_added = service.add_resume_embeddings(resume_id, embeddings)

        logger.info(
            "Resume indexed successfully",
            extra={
                "resume_id": resume_id,
                "embedding_types": list(embeddings.keys()),
                "vectors_added": vectors_added,
            },
        )

    except FaissIndexError as exc:
        logger.error(
            "FAISS index error during processing",
            extra={"resume_id": resume_id, "error": str(exc)},
        )
        return JSONResponse(
            status_code=500,
            content=format_error("INDEX_ERROR", "FAISS index error. Retrying."),
        )
    except Exception as exc:
        logger.exception(
            "Unexpected error during resume indexing",
            extra={"resume_id": resume_id},
        )
        return JSONResponse(
            status_code=500,
            content=format_error("INTERNAL_ERROR", "An unexpected error occurred. Retrying."),
        )

    return JSONResponse(
        status_code=200,
        content=format_success({"resumeId": resume_id, "status": "indexed"}),
    )
