"""AI Worker service application entrypoint.

Implements a FastAPI microservice that subscribes to the ``resume-ingested``
Cloud Pub/Sub topic via a push subscription, processes incoming resume IDs by
extracting structured fields and generating embeddings using Vertex AI, and
publishes processed events to the ``resume-indexed`` topic for downstream
consumers.
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from bowltie_py import format_error
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from toolbox_py import CorrelationIdMiddleware, get_logger, is_app_error, setup_logging

from app.config import settings
from app.routers import health, pubsub

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

    Initialises Hermes Pub/Sub on startup (if a GCP project ID is configured)
    and logs operational parameters.

    Args:
        app: The FastAPI application instance provided by the lifespan protocol.

    Returns:
        Async generator used by FastAPI to delimit startup and shutdown phases.
    """
    logger.info(
        "AI Worker service starting up",
        extra={
            "port": settings.port,
            "log_level": settings.log_level,
            "vertex_ai_location": settings.vertex_ai_location,
            "vertex_ai_extraction_model": settings.vertex_ai_extraction_model,
            "vertex_ai_embedding_model": settings.vertex_ai_embedding_model,
            "firestore_collection_resumes": settings.firestore_collection_resumes,
            "firestore_collection_embeddings": settings.firestore_collection_embeddings,
            "pubsub_topic_resume_ingested": settings.pubsub_topic_resume_ingested,
            "pubsub_topic_resume_indexed": settings.pubsub_topic_resume_indexed,
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
    logger.info("AI Worker service shutting down")


_OPENAPI_TAGS = [
    {
        "name": "Pub/Sub",
        "description": (
            "Push endpoint for Google Cloud Pub/Sub messages.  Receives "
            "``{ resumeId }`` messages from the ``resume-ingested`` subscription "
            "and triggers the AI processing pipeline."
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
    title="AI Worker",
    version="1.0.0",
    description=(
        "Resume AI processing microservice.  Subscribes to the ``resume-ingested`` "
        "Pub/Sub topic via push subscription, retrieves raw resume text from "
        "Firestore, extracts structured fields using Vertex AI Gemini, generates "
        "semantic embedding vectors, persists results to Firestore, and publishes "
        "``{ resumeId }`` to the ``resume-indexed`` topic for downstream indexing."
    ),
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/docs/json",
    openapi_tags=_OPENAPI_TAGS,
)

app.add_middleware(CorrelationIdMiddleware)

app.include_router(pubsub.router, prefix="/api/v1")
app.include_router(health.router, prefix="/health")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle FastAPI HTTP exceptions and format them using Bowltie.

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
