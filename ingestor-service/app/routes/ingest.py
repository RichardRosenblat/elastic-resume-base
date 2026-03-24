"""Ingest route — ``POST /ingest``.

Accepts an ingest request, enqueues background processing, and returns HTTP 202
immediately with a ``jobId`` that can be used to track progress.

Cross-cutting concerns:
- **Correlation ID**: read from ``request.state.correlation_id`` (set by
  :class:`toolbox.middleware.CorrelationIdMiddleware`) and forwarded into every
  Bowltie response envelope for distributed tracing.
- **Rate limiting**: applied via the shared :data:`~app.rate_limit.limiter`
  using the dynamic ``rate_limit`` string from ``app.state`` so the limit is
  fully driven by config.yaml values (``INGEST_RATE_LIMIT_MAX_REQUESTS`` /
  ``INGEST_RATE_LIMIT_WINDOW_SECONDS``).

Note: ``from __future__ import annotations`` is intentionally omitted here so
that FastAPI / Pydantic can resolve parameter type hints eagerly, which is
required when using the ``@limiter.limit()`` decorator from SlowAPI.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse

from bowltie import format_success

from app.models import IngestRequest, IngestResponse
from app.rate_limit import get_rate_limit_string, limiter
from app.services.ingest_service import IngestService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_ingest_service(request: Request) -> IngestService:
    """Dependency: retrieve the IngestService from application state."""
    return request.app.state.ingest_service  # type: ignore[no-any-return]


def _get_correlation_id(request: Request) -> str:
    """Dependency: retrieve the correlation ID from request state.

    The :class:`~toolbox.middleware.CorrelationIdMiddleware` always sets
    ``request.state.correlation_id`` before this dependency runs.
    """
    return str(getattr(request.state, "correlation_id", ""))


IngestServiceDep = Annotated[IngestService, Depends(_get_ingest_service)]
CorrelationIdDep = Annotated[str, Depends(_get_correlation_id)]


def _run_ingest(
    ingest_service: IngestService,
    job_id: str,
    sheet_id: str | None,
    metadata: dict[str, Any] | None,
    correlation_id: str,
) -> None:
    """Execute the ingest pipeline in the background.

    Logs any top-level failures but does not propagate them — per-row errors
    are already handled inside :class:`~app.services.ingest_service.IngestService`.

    Args:
        ingest_service: Injected service instance.
        job_id: Job identifier for log correlation.
        sheet_id: Google Sheets file ID to ingest from.
        metadata: Optional metadata to attach to ingested documents.
        correlation_id: Trace ID from the originating HTTP request.
    """
    try:
        logger.info(
            "Background ingest started: job_id=%s, sheet_id=%s, correlation_id=%s.",
            job_id,
            sheet_id,
            correlation_id,
        )
        if sheet_id:
            resume_ids = ingest_service.ingest_from_sheet(
                sheet_id=sheet_id, metadata=metadata
            )
            logger.info(
                "Background ingest complete: job_id=%s, ingested=%d, correlation_id=%s.",
                job_id,
                len(resume_ids),
                correlation_id,
            )
        else:
            logger.warning(
                "Background ingest job_id=%s: no sheet_id provided. correlation_id=%s.",
                job_id,
                correlation_id,
            )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Background ingest failed: job_id=%s, correlation_id=%s, error=%s.",
            job_id,
            correlation_id,
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
        "Returns HTTP 202 immediately with a ``jobId`` for tracking.  "
        "Pass ``x-correlation-id`` in the request headers for distributed tracing.  "
        "Rate-limited per client IP (configured via config.yaml)."
    ),
    tags=["Ingest"],
    responses={
        202: {"description": "Ingest job accepted."},
        400: {"description": "Validation error — neither sheet_id nor batch_id provided."},
        429: {"description": "Rate limit exceeded."},
        500: {"description": "Unexpected server error."},
    },
)
@limiter.limit(get_rate_limit_string)
async def ingest(
    request: Request,
    body: IngestRequest,
    background_tasks: BackgroundTasks,
    ingest_service: IngestServiceDep,
    correlation_id: CorrelationIdDep,
) -> JSONResponse:
    """Handle ``POST /ingest``.

    Validates the request, generates a job ID, enqueues the ingest pipeline
    as a background task, and returns HTTP 202 immediately.  The
    ``x-correlation-id`` is threaded through the response envelope and all
    background log lines.
    """
    job_id = f"job-{uuid.uuid4()}"
    accepted_at = datetime.now(tz=timezone.utc).isoformat()

    logger.info(
        "Ingest request accepted: job_id=%s, sheet_id=%s, batch_id=%s, correlation_id=%s.",
        job_id,
        body.sheet_id,
        body.batch_id,
        correlation_id,
    )

    background_tasks.add_task(
        _run_ingest,
        ingest_service=ingest_service,
        job_id=job_id,
        sheet_id=body.sheet_id,
        metadata=body.metadata,
        correlation_id=correlation_id,
    )

    response = IngestResponse(job_id=job_id, status="accepted", accepted_at=accepted_at)
    return JSONResponse(
        content=format_success(
            response.to_response_dict(), correlation_id=correlation_id
        ).to_dict(),
        status_code=202,
    )
