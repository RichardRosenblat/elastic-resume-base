"""FastAPI application factory for the Ingestor Service.

Call :func:`create_app` to build a configured application instance.  The
factory pattern makes it easy to inject mocked dependencies in tests.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from bowltie import format_error

from app.config import Settings
from app.routes.health import router as health_router
from app.routes.ingest import router as ingest_router
from app.services.drive_service import DriveService
from app.services.ingest_service import IngestService
from app.services.resume_store import ResumeStore
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

    Args:
        settings: Validated application settings.

    Returns:
        A fully wired :class:`~app.services.ingest_service.IngestService`.
    """
    from googleapiclient.discovery import build as google_build
    from google.cloud import firestore
    from hermes import get_event_publisher

    credentials = _build_google_credentials(settings)

    sheets_client = google_build("sheets", "v4", credentials=credentials)
    drive_client = google_build("drive", "v3", credentials=credentials)

    db = firestore.Client(project=settings.gcp_project_id)

    sheets = SheetsService(sheets_client=sheets_client)
    drive = DriveService(drive_client=drive_client)
    store = ResumeStore(db=db, collection=settings.firestore_resumes_collection)
    publisher = get_event_publisher()

    return IngestService(
        sheets=sheets,
        drive=drive,
        store=store,
        publisher=publisher,
        ingestor_topic=settings.pubsub_ingestor_topic,
        dlq_topic=settings.pubsub_dlq_topic,
    )


def create_app(
    settings: Settings,
    ingest_service: IngestService | None = None,
) -> FastAPI:
    """Build and configure the FastAPI application.

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
            "stores results in Firestore, and publishes Pub/Sub events."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
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
        logger.warning("Validation error: %s", exc.errors())
        return JSONResponse(
            status_code=400,
            content=format_error("VALIDATION_ERROR", str(exc)).to_dict(),
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled exception: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content=format_error("INTERNAL_ERROR", "An unexpected error occurred").to_dict(),
        )

    # ------------------------------------------------------------------
    # Register routers
    # ------------------------------------------------------------------
    app.include_router(health_router)
    app.include_router(ingest_router, prefix="/api/v1")

    return app
