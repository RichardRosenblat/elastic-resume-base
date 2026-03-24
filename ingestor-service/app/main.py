"""FastAPI application factory for the Ingestor Service.

Call :func:`create_app` to build a configured application instance.  The
factory pattern makes it easy to inject mocked dependencies in tests.

Cross-cutting concerns applied here:
- :class:`~toolbox.middleware.CorrelationIdMiddleware` — attaches /
  generates ``x-correlation-id`` on every request.
- ``SlowAPIMiddleware`` — rate-limits ``POST /ingest`` using settings from
  ``config.yaml`` (``INGEST_RATE_LIMIT_MAX_REQUESTS`` /
  ``INGEST_RATE_LIMIT_WINDOW_SECONDS``).
"""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler  # type: ignore[import-untyped]
from slowapi.errors import RateLimitExceeded  # type: ignore[import-untyped]

from bowltie import format_error
from toolbox import CorrelationIdMiddleware

from app.config import Settings
from app.rate_limit import _rate_limit_config, limiter
from app.routes.health import router as health_router
from app.routes.ingest import router as ingest_router
from app.services.drive_service import DriveService
from app.services.ingest_service import IngestService
from app.services.sheets_service import SheetsService

logger = logging.getLogger(__name__)


def _build_google_credentials(settings: Settings) -> Any:
    """Return Google API credentials using a service-account key or ADC.

    When ``settings.google_service_account_key`` points to a valid JSON key
    file, ``ServiceAccountCredentials`` are used.  Otherwise Application
    Default Credentials (ADC) are used — this works on Cloud Run and in local
    development via ``gcloud auth application-default login``.

    Args:
        settings: Validated application settings.

    Returns:
        A ``google.oauth2.credentials.Credentials``-compatible object.
    """
    from google.oauth2 import service_account
    import google.auth

    scopes = [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
    ]

    key_path = settings.google_service_account_key
    if key_path and os.path.isfile(key_path):
        logger.debug("Using service-account key file: %s", key_path)
        return service_account.Credentials.from_service_account_file(key_path, scopes=scopes)

    logger.debug("Using Application Default Credentials.")
    creds, _ = google.auth.default(scopes=scopes)
    return creds


def _build_ingest_service(settings: Settings) -> IngestService:
    """Construct and wire up the IngestService with real GCP clients.

    Pub/Sub access is exclusively through Hermes (:func:`hermes.get_event_publisher`).
    Firestore access is exclusively through Synapse (:func:`synapse.get_resume_store`).
    Neither ``google-cloud-pubsub`` nor ``google-cloud-firestore`` are imported
    directly in this service.

    Args:
        settings: Validated application settings.

    Returns:
        A fully wired :class:`~app.services.ingest_service.IngestService`.
    """
    from googleapiclient.discovery import build as google_build
    from hermes import get_event_publisher
    from synapse import get_resume_store

    credentials = _build_google_credentials(settings)

    sheets_client = google_build("sheets", "v4", credentials=credentials)
    drive_client = google_build("drive", "v3", credentials=credentials)

    sheets = SheetsService(sheets_client=sheets_client)
    drive = DriveService(drive_client=drive_client)

    # Synapse is the sole Firestore abstraction — no direct firestore import.
    store = get_resume_store()

    # Hermes is the sole Pub/Sub abstraction — no direct pubsub import.
    publisher = get_event_publisher()

    return IngestService(
        sheets=sheets,
        drive=drive,
        store=store,
        publisher=publisher,
        ingestor_topic=settings.pubsub_ingestor_topic,
        dlq_topic=settings.pubsub_dlq_topic,
        max_ai_calls_per_batch=settings.max_ai_calls_per_batch,
    )


def create_app(
    settings: Settings,
    ingest_service: IngestService | None = None,
) -> FastAPI:
    """Build and configure the FastAPI application.

    Registers:
    - :class:`~toolbox.middleware.CorrelationIdMiddleware` — distributed
      tracing via ``x-correlation-id`` header.
    - ``SlowAPIMiddleware`` — rate limiting on ``POST /ingest`` using the
      ``INGEST_RATE_LIMIT_MAX_REQUESTS`` / ``INGEST_RATE_LIMIT_WINDOW_SECONDS``
      values from settings.

    Args:
        settings: Validated application settings.
        ingest_service: Optional pre-built service instance.  When ``None``
            (the default, used in production), the service is built from real
            GCP clients.  Pass a mock instance in tests.

    Returns:
        A configured :class:`fastapi.FastAPI` instance.
    """
    app = FastAPI(
        title="Ingestor Service",
        description=(
            "Downloads resumes from Google Sheets / Drive, extracts text, "
            "stores results in Firestore via Synapse, and publishes Pub/Sub "
            "events via Hermes."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ------------------------------------------------------------------
    # Middleware — order matters: outermost middleware runs first.
    # ------------------------------------------------------------------

    # 1. Correlation ID: attach / generate x-correlation-id on every request.
    app.add_middleware(CorrelationIdMiddleware)

    # 2. Rate limiting: protect POST /ingest from excessive load.
    # Update the module-level config so get_rate_limit_string() returns the
    # correct value when called by SlowAPI at request time.
    rate_limit_str = (
        f"{settings.ingest_rate_limit_max_requests}/"
        f"{settings.ingest_rate_limit_window_seconds}second"
    )
    _rate_limit_config["limit"] = rate_limit_str
    app.state.rate_limit = rate_limit_str
    app.state.limiter = limiter
    app.add_exception_handler(
        RateLimitExceeded,
        _rate_limit_exceeded_handler,  # type: ignore[arg-type]
    )

    # ------------------------------------------------------------------
    # Attach services to app.state so route handlers can access them.
    # ------------------------------------------------------------------
    if ingest_service is not None:
        app.state.ingest_service = ingest_service
    else:
        app.state.ingest_service = _build_ingest_service(settings)

    # ------------------------------------------------------------------
    # Exception handlers
    # ------------------------------------------------------------------

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        correlation_id = str(getattr(request.state, "correlation_id", ""))
        logger.warning("Validation error (correlation_id=%s): %s", correlation_id, exc.errors())
        return JSONResponse(
            status_code=400,
            content=format_error(
                "VALIDATION_ERROR", str(exc), correlation_id=correlation_id
            ).to_dict(),
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        correlation_id = str(getattr(request.state, "correlation_id", ""))
        logger.error(
            "Unhandled exception (correlation_id=%s): %s",
            correlation_id,
            exc,
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content=format_error(
                "INTERNAL_ERROR",
                "An unexpected error occurred",
                correlation_id=correlation_id,
            ).to_dict(),
        )

    # ------------------------------------------------------------------
    # Register routers
    # ------------------------------------------------------------------
    app.include_router(health_router)
    app.include_router(ingest_router, prefix="/api/v1")

    return app
