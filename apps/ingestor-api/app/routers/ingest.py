"""Ingest router for the ingestor service.

Exposes the ``POST /api/v1/ingest`` endpoint that triggers the resume
ingestion pipeline from a Google Sheet, ``POST /api/v1/ingest/upload``
for direct Excel / CSV file uploads, ``POST /api/v1/ingest/drive`` for
a single Google Drive link, and ``POST /api/v1/ingest/file`` for a
directly uploaded PDF or DOCX resume.
"""

from __future__ import annotations

import json
from typing import Annotated

from bowltie_py import format_error, format_success
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from toolbox_py import get_correlation_id, get_logger

from app.config import settings
from app.models.ingest import (
    DriveLinkIngestRequest,
    FileIngestRequest,
    IngestRequest,
    IngestResponse,
    SingleIngestResponse,
)
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

_INGEST_SUCCESS_SCHEMA: dict[str, object] = {
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

_SINGLE_INGEST_SUCCESS_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "success": {"type": "boolean", "example": True},
        "data": {
            "type": "object",
            "properties": {
                "resumeId": {
                    "type": "string",
                    "nullable": True,
                    "example": "resume-abc123",
                    "description": "Firestore document ID of the ingested resume, or null if ingestion failed.",
                },
                "ingested": {
                    "type": "integer",
                    "example": 1,
                    "description": "1 when the resume was successfully ingested, 0 otherwise.",
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
                    "description": "Errors encountered during ingestion.",
                },
                "duplicates": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "row": {"type": "integer"},
                            "existingResumeId": {"type": "string"},
                            "message": {"type": "string"},
                        },
                    },
                    "description": "Non-empty when the document was a duplicate of an already-ingested resume.",
                },
            },
        },
    },
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
    )
    return IngestService(resume_store=FirestoreResumeStore(settings.firestore_collection_resumes))


@router.post(
    "/ingest",
    summary="Trigger a resume ingestion job from a Google Sheet",
    description=(
        "Downloads resumes from a Google Sheet (identified by ``sheet_id`` or ``sheet_url``), "
        "extracts plain text, stores each resume in Firestore, and publishes a "
        "``{ resumeId }`` message to the ``resume-ingested`` Pub/Sub topic.\n\n"
        "The sheet must contain a column (default: ``resume_link``) with Google Drive "
        "links to individual resume files (PDF or DOCX).  Embedded hyperlinks (badges) "
        "are automatically extracted in addition to plain text values.\n\n"
        "Use ``sheet_name`` to specify which tab to read.  Set ``has_header_row`` to "
        "``false`` and supply ``link_column_index`` when the sheet has no header row.\n\n"
        "The response includes the number of successfully ingested resumes and a list "
        "of row-level errors."
    ),
    responses={
        200: {
            "description": "Ingestion completed (with possible partial errors).",
            "content": {"application/json": {"schema": _INGEST_SUCCESS_SCHEMA}},
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
            and optional ``link_column``, ``sheet_name``, ``has_header_row``,
            ``link_column_index``, and ``metadata`` fields.
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
            "sheet_name": body.sheet_name,
            "has_header_row": body.has_header_row,
            "link_column": body.link_column,
            "link_column_index": body.link_column_index,
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


@router.post(
    "/ingest/upload",
    summary="Trigger a resume ingestion job from an uploaded file",
    description=(
        "Upload an Excel (``.xlsx``, ``.xls``) or CSV (``.csv``) file "
        "containing Google Drive links to resume files.  The service downloads each "
        "linked resume, extracts plain text, stores it in Firestore, and publishes a "
        "``{ resumeId }`` message to the ``resume-ingested`` Pub/Sub topic.\n\n"
        "Embedded cell hyperlinks (badges) in Excel files are extracted automatically.\n\n"
        "Use ``sheet_name`` to specify the worksheet tab (Excel only).  "
        "Set ``has_header_row`` to ``false`` and supply ``link_column_index`` when the "
        "file has no header row."
    ),
    responses={
        200: {
            "description": "Ingestion completed (with possible partial errors).",
            "content": {"application/json": {"schema": _INGEST_SUCCESS_SCHEMA}},
        },
        400: {
            "description": "Invalid request parameters or unsupported file format.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        422: {
            "description": "Validation error — missing required fields.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        502: {
            "description": "Failed to connect to a downstream service.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
    },
)
async def ingest_upload(
    request: Request,
    file: Annotated[UploadFile, File(description="Excel (.xlsx/.xls) or CSV (.csv) file.")],
    sheet_name: Annotated[
        str | None,
        Form(description="Sheet tab name (Excel only).  Defaults to the first sheet."),
    ] = None,
    has_header_row: Annotated[
        bool,
        Form(description="Whether the first row is a header row.  Defaults to true."),
    ] = True,
    link_column: Annotated[
        str | None,
        Form(
            description=(
                "Column header containing Drive links.  "
                "Used when has_header_row is true.  "
                "Defaults to the service-level 'sheets_link_column' setting."
            )
        ),
    ] = None,
    link_column_index: Annotated[
        int | None,
        Form(
            description=(
                "1-based column number containing Drive links.  "
                "Required when has_header_row is false."
            ),
            ge=1,
        ),
    ] = None,
    metadata: Annotated[
        str | None,
        Form(
            description=(
                "Optional JSON object of extra metadata attached to every ingested resume.  "
                "Example: ``{\"source\": \"careers-fair-2024\"}``"
            )
        ),
    ] = None,
) -> JSONResponse:
    """Trigger a resume ingestion job from an uploaded Excel or CSV file.

    Parses the uploaded file to extract Google Drive links, downloads each
    resume, extracts text, stores it in Firestore, and publishes a Pub/Sub
    message per ingested resume.

    Args:
        request: The incoming HTTP request.
        file: The uploaded spreadsheet file.
        sheet_name: Worksheet tab name (Excel only).
        has_header_row: Whether the first row contains column headers.
        link_column: Column header name for Drive links.
        link_column_index: 1-based column number for Drive links.
        metadata: JSON-encoded extra metadata string.

    Returns:
        JSONResponse with a Bowltie-formatted success envelope.

    Raises:
        HTTPException 400: If the file format is unsupported or parameters are
            invalid.
        HTTPException 502: If a downstream service call fails.
    """
    correlation_id = get_correlation_id()

    # Parse the optional JSON metadata string.
    parsed_metadata: dict = {}
    if metadata:
        try:
            parsed_metadata = json.loads(metadata)
            if not isinstance(parsed_metadata, dict):
                raise ValueError("metadata must be a JSON object")
        except (json.JSONDecodeError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid 'metadata' field: {exc}",
            ) from exc

    # Validate the form parameters via the Pydantic model.
    try:
        file_request = FileIngestRequest(
            sheet_name=sheet_name,
            has_header_row=has_header_row,
            link_column=link_column,
            link_column_index=link_column_index,
            metadata=parsed_metadata,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    filename = file.filename or "upload"
    logger.info(
        "File ingest request received",
        extra={
            "upload_filename": filename,
            "sheet_name": file_request.sheet_name,
            "has_header_row": file_request.has_header_row,
            "link_column": file_request.link_column,
            "link_column_index": file_request.link_column_index,
        },
    )

    file_bytes = await file.read()
    service = _get_ingest_service()

    try:
        result = await service.ingest_file(
            file_bytes=file_bytes,
            filename=filename,
            request=file_request,
        )
    except ValueError as exc:
        logger.warning("Invalid file ingest request: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    logger.info(
        "File ingest request complete",
        extra={"ingested": result.ingested, "errors": len(result.errors)},
    )

    return JSONResponse(
        format_success(result.model_dump(), correlation_id=correlation_id)
    )


@router.post(
    "/ingest/drive",
    summary="Ingest a single resume from a Google Drive link",
    description=(
        "Downloads a single resume file from the provided Google Drive link, "
        "extracts plain text, stores it in Firestore, and publishes a "
        "``{ resumeId }`` message to the ``resume-ingested`` Pub/Sub topic.\n\n"
        "Supported file types: PDF and DOCX.  The response includes the "
        "Firestore document ID of the ingested resume and an indication of "
        "whether the document was a duplicate."
    ),
    responses={
        200: {
            "description": "Ingestion completed.",
            "content": {"application/json": {"schema": _SINGLE_INGEST_SUCCESS_SCHEMA}},
        },
        400: {
            "description": "Invalid request body or unsupported file type.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        422: {
            "description": "Validation error — missing required fields.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
    },
)
async def ingest_drive(body: DriveLinkIngestRequest, request: Request) -> JSONResponse:
    """Ingest a single resume from a Google Drive link.

    Downloads the resume file from the given Drive URL or file ID,
    extracts text, stores it in Firestore, and publishes a Pub/Sub message.

    Args:
        body: Validated drive-link ingest request containing ``driveLink`` and
            optional ``metadata`` and ``userId``.
        request: The incoming HTTP request (used for correlation ID extraction).

    Returns:
        JSONResponse with a Bowltie-formatted success envelope containing the
        :class:`~app.models.ingest.SingleIngestResponse` data.
    """
    correlation_id = get_correlation_id()
    logger.info(
        "Drive-link ingest request received",
        extra={"drive_link": body.drive_link},
    )

    service = _get_ingest_service()
    result: SingleIngestResponse = await service.ingest_drive_link(body)

    logger.info(
        "Drive-link ingest request complete",
        extra={"ingested": result.ingested, "resume_id": result.resume_id},
    )

    return JSONResponse(
        format_success(result.model_dump(by_alias=True), correlation_id=correlation_id)
    )


@router.post(
    "/ingest/file",
    summary="Ingest a single resume from a directly uploaded file",
    description=(
        "Upload a single PDF or DOCX resume file for direct ingestion.  "
        "The service extracts plain text, stores it in Firestore, and publishes a "
        "``{ resumeId }`` message to the ``resume-ingested`` Pub/Sub topic.\n\n"
        "Supported file types: ``.pdf``, ``.docx``."
    ),
    responses={
        200: {
            "description": "Ingestion completed.",
            "content": {"application/json": {"schema": _SINGLE_INGEST_SUCCESS_SCHEMA}},
        },
        400: {
            "description": "Unsupported file type or invalid parameters.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        422: {
            "description": "Validation error — missing required fields.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
    },
)
async def ingest_file_direct(
    request: Request,
    file: Annotated[UploadFile, File(description="PDF (.pdf) or DOCX (.docx) resume file.")],
    metadata: Annotated[
        str | None,
        Form(
            description=(
                "Optional JSON object of extra metadata attached to the ingested resume.  "
                "Example: ``{\"source\": \"careers-fair-2024\"}``"
            )
        ),
    ] = None,
    user_id: Annotated[
        str | None,
        Form(
            description="Firebase UID of the requesting user (injected by the Gateway).",
        ),
    ] = None,
) -> JSONResponse:
    """Ingest a single resume from a directly uploaded PDF or DOCX file.

    Extracts plain text from the file, stores it in Firestore, and publishes
    a Pub/Sub message.

    Args:
        request: The incoming HTTP request.
        file: The uploaded resume file (PDF or DOCX).
        metadata: JSON-encoded extra metadata string.
        user_id: Firebase UID of the requesting user.

    Returns:
        JSONResponse with a Bowltie-formatted success envelope containing the
        :class:`~app.models.ingest.SingleIngestResponse` data.
    """
    correlation_id = get_correlation_id()

    # Parse the optional JSON metadata string.
    parsed_metadata: dict = {}
    if metadata:
        try:
            parsed_metadata = json.loads(metadata)
            if not isinstance(parsed_metadata, dict):
                raise ValueError("metadata must be a JSON object")
        except (json.JSONDecodeError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid 'metadata' field: {exc}",
            ) from exc

    filename = file.filename or "upload"
    logger.info(
        "Direct file ingest request received",
        extra={"upload_filename": filename},
    )

    file_bytes = await file.read()
    service = _get_ingest_service()

    result: SingleIngestResponse = await service.ingest_direct_file(
        file_bytes=file_bytes,
        filename=filename,
        metadata=parsed_metadata,
        user_id=user_id,
    )

    logger.info(
        "Direct file ingest request complete",
        extra={"ingested": result.ingested, "resume_id": result.resume_id},
    )

    return JSONResponse(
        format_success(result.model_dump(by_alias=True), correlation_id=correlation_id)
    )
