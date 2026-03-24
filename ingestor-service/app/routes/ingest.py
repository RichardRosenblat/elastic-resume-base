"""Ingest route — ``POST /ingest``.

Accepts an ingest request, enqueues background processing, and returns HTTP 202
immediately with a ``jobId`` that can be used to track progress.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse

from bowltie import format_error, format_success

from app.models import IngestRequest, IngestResponse
from app.services.ingest_service import IngestService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_ingest_service(request: Request) -> IngestService:
    """Dependency: retrieve the IngestService from application state."""
    return request.app.state.ingest_service  # type: ignore[no-any-return]


IngestServiceDep = Annotated[IngestService, Depends(_get_ingest_service)]


def _run_ingest(
    ingest_service: IngestService,
    job_id: str,
    sheet_id: str | None,
    metadata: dict[str, Any] | None,
) -> None:
    """Execute the ingest pipeline in the background.

    Logs any top-level failures but does not propagate them — per-row errors
    are already handled inside :class:`~app.services.ingest_service.IngestService`.

    Args:
        ingest_service: Injected service instance.
        job_id: Job identifier for log correlation.
        sheet_id: Google Sheets file ID to ingest from.
        metadata: Optional metadata to attach to ingested documents.
    """
    try:
        logger.info("Background ingest started: job_id=%s, sheet_id=%s.", job_id, sheet_id)
        if sheet_id:
            resume_ids = ingest_service.ingest_from_sheet(
                sheet_id=sheet_id, metadata=metadata
            )
            logger.info(
                "Background ingest complete: job_id=%s, ingested=%d.",
                job_id,
                len(resume_ids),
            )
        else:
            logger.warning("Background ingest job_id=%s: no sheet_id provided.", job_id)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Background ingest failed: job_id=%s, error=%s.",
            job_id,
            exc,
            exc_info=True,
        )


@router.post(
    "/ingest",
    status_code=202,
    summary="Trigger a resume ingest job",
    description=(
        "Accepts an ingest request and enqueues asynchronous processing.  "
        "Either ``sheet_id`` or ``batch_id`` must be provided.  "
        "Returns HTTP 202 immediately with a ``job_id`` for tracking."
    ),
    tags=["Ingest"],
    responses={
        202: {"description": "Ingest job accepted."},
        400: {"description": "Validation error — neither sheet_id nor batch_id provided."},
        500: {"description": "Unexpected server error."},
    },
)
async def ingest(
    body: IngestRequest,
    background_tasks: BackgroundTasks,
    ingest_service: IngestServiceDep,
) -> JSONResponse:
    """Handle ``POST /ingest``.

    Validates the request, generates a job ID, enqueues the ingest pipeline
    as a background task, and returns HTTP 202 immediately.
    """
    job_id = f"job-{uuid.uuid4()}"
    accepted_at = datetime.now(tz=timezone.utc).isoformat()

    logger.info(
        "Ingest request accepted: job_id=%s, sheet_id=%s, batch_id=%s.",
        job_id,
        body.sheet_id,
        body.batch_id,
    )

    background_tasks.add_task(
        _run_ingest,
        ingest_service=ingest_service,
        job_id=job_id,
        sheet_id=body.sheet_id,
        metadata=body.metadata,
    )

    response = IngestResponse(job_id=job_id, status="accepted", accepted_at=accepted_at)
    return JSONResponse(
        content=format_success(response.to_response_dict()).to_dict(),
        status_code=202,
    )
