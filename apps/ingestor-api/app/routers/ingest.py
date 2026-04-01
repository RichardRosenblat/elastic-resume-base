"""Ingest router for the ingestor service.

Exposes the ``POST /api/v1/ingest`` endpoint that triggers the resume
ingestion pipeline.
"""

from __future__ import annotations

from bowltie_py import format_error, format_success
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from toolbox_py import get_correlation_id, get_logger

from app.config import settings
from app.models.ingest import IngestRequest, IngestResponse
from app.services.ingest_service import IngestService
from app.utils.exceptions import SheetReadError

logger = get_logger(__name__)

router = APIRouter(tags=["Ingest"])

_BOWLTIE_ERROR_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "success": {"type": "boolean", "example": False},
        "error": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "example": "BAD_REQUEST"},
                "message": {
                    "type": "string",
                    "example": "Human-readable error description",
                },
            },
            "required": ["code", "message"],
        },
        "meta": {
            "type": "object",
            "properties": {
                "correlationId": {
                    "type": "string",
                    "example": "00000000-0000-0000-0000-000000000000",
                },
                "timestamp": {
                    "type": "string",
                    "format": "date-time",
                    "example": "2024-01-01T00:00:00.000Z",
                },
            },
        },
    },
    "required": ["success", "error", "meta"],
}


def _get_ingest_service() -> IngestService:
    """Create an :class:`~app.services.ingest_service.IngestService` instance.

    Initialises Synapse (Firestore) and returns a fully wired service.

    Returns:
        A configured :class:`~app.services.ingest_service.IngestService`.
    """
    from synapse_py import FirestoreResumeStore, initialize_persistence

    initialize_persistence(
        project_id=settings.gcp_project_id or "demo-project",
        service_account_key=settings.google_service_account_key or None,
    )
    return IngestService(resume_store=FirestoreResumeStore(settings.firestore_collection_resumes))


@router.post(
    "/ingest",
    summary="Trigger a resume ingestion job",
    description=(
        "Downloads resumes from a Google Sheet (identified by ``sheet_id`` or ``sheet_url``), "
        "extracts plain text, stores each resume in Firestore, and publishes a "
        "``{ resumeId }`` message to the ``resume-ingested`` Pub/Sub topic.\n\n"
        "The sheet must contain a column (default: ``resume_link``) with Google Drive "
        "links to individual resume files (PDF or DOCX).\n\n"
        "The response includes the number of successfully ingested resumes and a list "
        "of row-level errors."
    ),
    responses={
        200: {
            "description": "Ingestion completed (with possible partial errors).",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "success": {"type": "boolean", "example": True},
                            "data": {
                                "type": "object",
                                "properties": {
                                    "ingested": {
                                        "type": "integer",
                                        "example": 5,
                                        "description": "Number of successfully ingested resumes.",
                                    },
                                    "errors": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "row": {"type": "integer"},
                                                "error": {"type": "string"},
                                            },
                                        },
                                        "description": "Per-row errors encountered during ingestion.",
                                    },
                                },
                            },
                        },
                    }
                }
            },
        },
        400: {
            "description": "Invalid request body.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        422: {
            "description": "Validation error — missing required fields.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        502: {
            "description": "Failed to read Google Sheet or connect to a downstream service.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
    },
)
async def ingest(body: IngestRequest, request: Request) -> JSONResponse:
    """Trigger a resume ingestion job from a Google Sheet.

    Reads Drive links from the specified column in the Google Sheet,
    downloads each resume file, extracts text, stores it in Firestore,
    and publishes a Pub/Sub message per ingested resume.

    Args:
        body: Validated ingest request containing ``sheet_id`` or ``sheet_url``
            and optional ``link_column`` and ``metadata`` fields.
        request: The incoming HTTP request (used for correlation ID extraction).

    Returns:
        JSONResponse with a Bowltie-formatted success envelope containing the
        :class:`~app.models.ingest.IngestResponse` data.

    Raises:
        HTTPException 400: If the sheet ID cannot be resolved.
        HTTPException 502: If reading the Google Sheet fails.
    """
    correlation_id = get_correlation_id()
    logger.info(
        "Ingest request received",
        extra={
            "sheet_id": body.sheet_id,
            "sheet_url": body.sheet_url,
            "link_column": body.link_column,
        },
    )

    service = _get_ingest_service()

    try:
        result: IngestResponse = await service.ingest(body)
    except ValueError as exc:
        logger.warning("Invalid ingest request: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SheetReadError as exc:
        logger.error("Sheet read error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to read Google Sheet: {exc}",
        ) from exc

    logger.info(
        "Ingest request complete",
        extra={"ingested": result.ingested, "errors": len(result.errors)},
    )

    return JSONResponse(
        format_success(result.model_dump(), correlation_id=correlation_id)
    )
