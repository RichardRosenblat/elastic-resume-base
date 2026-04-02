"""Ingestor service application entrypoint.

Implements a FastAPI microservice that downloads resumes from Google Sheets
and Drive, extracts plain text, stores the text in Firestore, and publishes
ingestion events to Cloud Pub/Sub.
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from bowltie_py import format_error
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from toolbox_py import CorrelationIdMiddleware, get_logger, is_app_error, setup_logging

from app.config import settings
from app.routers import health, ingest
from app.utils.timeout_middleware import TimeoutMiddleware

# Apply the service-account key path for local development before any GCP
# client is constructed.  setdefault only sets the var when it is not already
# present in the environment so that shell / Docker / CI credentials always
# take precedence over the config-file value.
if settings.google_application_credentials:
    os.environ.setdefault(
        "GOOGLE_APPLICATION_CREDENTIALS", settings.google_application_credentials
    )

setup_logging(level=settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown lifecycle hooks for the FastAPI app.

    Logs runtime configuration on startup and emits a shutdown log entry when
    the application is terminating.

    Args:
        app: The FastAPI application instance provided by the lifespan protocol.

    Returns:
        Async generator used by FastAPI to delimit startup and shutdown phases.
    """
    logger.info(
        "Ingestor service starting up",
        extra={
            "port": settings.port,
            "log_level": settings.log_level,
            "firestore_collection": settings.firestore_collection_resumes,
            "pubsub_topic": settings.pubsub_topic_resume_ingested,
            "sheets_link_column": settings.sheets_link_column,
        },
    )
    logger.debug(
        "GCP configuration",
        extra={
            "gcp_project_id": settings.gcp_project_id or "(not set)",
            "google_application_credentials": (
                settings.google_application_credentials or "(using ADC)"
            ),
        },
    )

    # Initialise Hermes Pub/Sub if a GCP project ID is configured.
    if settings.gcp_project_id:
        try:
            from hermes_py import initialize_pubsub_from_env

            initialize_pubsub_from_env()
            logger.debug("Hermes Pub/Sub initialised.")
        except Exception as exc:
            logger.warning("Hermes Pub/Sub initialisation failed: %s", exc)

    yield
    logger.info("Ingestor service shutting down")


_OPENAPI_TAGS = [
    {
        "name": "Ingest",
        "description": (
            "Resume ingestion endpoints.  Download resumes from Google Sheets / Drive, "
            "extract text, store in Firestore, and publish Pub/Sub events."
        ),
    },
    {
        "name": "Health",
        "description": (
            "Liveness and readiness probes used by container orchestrators "
            "(Cloud Run, Kubernetes) to monitor service health."
        ),
    },
]

app = FastAPI(
    title="Ingestor",
    version="1.0.0",
    description=(
        "Resume ingestor microservice.  Reads resume file links from a Google Sheet, "
        "downloads each file from Google Drive, extracts plain text, writes the raw "
        "text to Firestore (``resumes`` collection), and publishes a "
        "``{ resumeId }`` message to the ``resume-ingested`` Pub/Sub topic to "
        "trigger the AI processing pipeline."
    ),
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/docs/json",
    openapi_tags=_OPENAPI_TAGS,
)

app.add_middleware(TimeoutMiddleware, timeout_seconds=settings.http_request_timeout)
app.add_middleware(CorrelationIdMiddleware)

app.include_router(ingest.router, prefix="/api/v1")
app.include_router(health.router, prefix="/health")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle FastAPI HTTP exceptions and format them using Bowltie.

    Maps the HTTP status code to a machine-readable error code and wraps
    the response in the standard Bowltie error envelope.

    Args:
        request: The incoming HTTP request.
        exc: The :class:`~fastapi.HTTPException` raised by a route handler.

    Returns:
        JSONResponse with Bowltie-formatted error envelope.
    """
    _code_map: dict[int, str] = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMIT_EXCEEDED",
        500: "INTERNAL_ERROR",
        502: "DOWNSTREAM_ERROR",
        503: "SERVICE_UNAVAILABLE",
    }
    code = _code_map.get(exc.status_code, "HTTP_ERROR")
    if exc.status_code >= 500:
        logger.error(
            "HTTP error response",
            extra={
                "status_code": exc.status_code,
                "detail": str(exc.detail),
                "path": request.url.path,
            },
        )
    elif exc.status_code >= 400:
        logger.warning(
            "HTTP client error response",
            extra={
                "status_code": exc.status_code,
                "detail": str(exc.detail),
                "path": request.url.path,
            },
        )
    return JSONResponse(
        status_code=exc.status_code,
        content=format_error(code, str(exc.detail)),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unhandled exceptions and format them using Bowltie.

    Catches all :class:`~toolbox_py.AppError` subclasses and formats them
    through Bowltie.  Any other unexpected exception is treated as an internal
    server error.

    Args:
        request: The incoming HTTP request.
        exc: The exception that propagated to the ASGI layer.

    Returns:
        JSONResponse with Bowltie-formatted error envelope.
    """
    if is_app_error(exc):
        logger.warning(
            "Application error",
            extra={
                "code": exc.code,  # type: ignore[union-attr]
                "message": exc.message,  # type: ignore[union-attr]
                "status_code": exc.status_code,  # type: ignore[union-attr]
                "path": request.url.path,
            },
        )
        return JSONResponse(
            status_code=exc.status_code,  # type: ignore[union-attr]
            content=format_error(exc.code, exc.message),  # type: ignore[union-attr]
        )
    logger.exception("Unhandled exception", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content=format_error("INTERNAL_ERROR", "An unexpected error occurred"),
    )
