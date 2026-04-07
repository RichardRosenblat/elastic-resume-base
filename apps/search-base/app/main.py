"""Search Base service application entrypoint.

Implements a FastAPI microservice that subscribes to the ``resume-indexed``
Cloud Pub/Sub topic via a push subscription, indexes new resume embeddings
into a FAISS vector index, and exposes a search endpoint for natural language
queries against the index.  The index is optionally persisted to a mounted
volume to survive container restarts.
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from bowltie_py import format_error
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from synapse_py import initialize_persistence
from toolbox_py import CorrelationIdMiddleware, get_logger, is_app_error, setup_logging

from app.config import settings
from app.dependencies import set_search_service
from app.routers import health, pubsub, search
from app.services.search_service import SearchService

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

    Initializes Firestore, Hermes Pub/Sub, and the FAISS search service on
    startup.  Optionally saves the index to disk on shutdown.

    Args:
        app: The FastAPI application instance provided by the lifespan protocol.

    Returns:
        Async generator used by FastAPI to delimit startup and shutdown phases.
    """
    logger.info(
        "Search Base service starting up",
        extra={
            "port": settings.port,
            "log_level": settings.log_level,
            "vertex_ai_location": settings.vertex_ai_location,
            "vertex_ai_embedding_model": settings.vertex_ai_embedding_model,
            "firestore_collection_resumes": settings.firestore_collection_resumes,
            "firestore_collection_embeddings": settings.firestore_collection_embeddings,
            "pubsub_topic_resume_indexed": settings.pubsub_topic_resume_indexed,
            "faiss_index_path": settings.faiss_index_path or "(in-memory only)",
            "faiss_index_metric": settings.faiss_index_metric,
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

    # Initialize Firestore
    if settings.gcp_project_id:
        initialize_persistence(project_id=settings.gcp_project_id)
        logger.debug("Firestore initialized.")

        # Initialize Hermes Pub/Sub
        try:
            from hermes_py import initialize_pubsub_from_env

            initialize_pubsub_from_env()
            logger.debug("Hermes Pub/Sub initialized.")
        except Exception as exc:
            logger.warning("Hermes Pub/Sub initialization failed: %s", exc)

    # Initialize the search service
    search_service = SearchService(
        embedding_dim=768,  # text-multilingual-embedding-002
        index_path=settings.faiss_index_path,
        metric=settings.faiss_index_metric,
        decrypt_kms_key_name=settings.decrypt_kms_key_name,
    )
    search_service.initialize()
    set_search_service(search_service)
    logger.info("Search service initialized")

    yield

    # Shutdown: Save index to disk if configured
    logger.info("Search Base service shutting down")
    if settings.faiss_index_path:
        try:
            search_service.save_to_disk()
            logger.info("Index saved to disk on shutdown")
        except Exception as exc:
            logger.error("Failed to save index on shutdown: %s", exc)


_OPENAPI_TAGS = [
    {
        "name": "Search",
        "description": (
            "Semantic search endpoints for natural language queries against the "
            "resume index.  Uses FAISS for fast similarity search and Vertex AI "
            "for query embedding generation."
        ),
    },
    {
        "name": "Pub/Sub",
        "description": (
            "Push endpoint for Google Cloud Pub/Sub messages.  Receives "
            "``{ resumeId }`` messages from the ``resume-indexed`` subscription "
            "and adds embeddings to the FAISS index."
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
    title="Search Base",
    version="1.0.0",
    description=(
        "Resume semantic search microservice.  Manages an in-memory FAISS index "
        "for fast vector similarity search.  Subscribes to the ``resume-indexed`` "
        "Pub/Sub topic to receive new embeddings, exposes a search endpoint for "
        "natural language queries, and optionally persists the index to disk."
    ),
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/docs/json",
    openapi_tags=_OPENAPI_TAGS,
)

app.add_middleware(CorrelationIdMiddleware)

app.include_router(search.router, prefix="/api/v1")
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
