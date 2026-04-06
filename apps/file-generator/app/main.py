"""File Generator service application entrypoint.

Implements a FastAPI microservice that generates resume documents on demand.
The service retrieves structured resume JSON from Firestore, fetches a
``.docx`` Jinja2 template file from Google Drive using the Bugle shared
library, renders the template with the resume data, and returns the final
document to the caller.

Optionally, if a translation is requested, the service calls the Google Cloud
Translation API before rendering — with results cached in Firestore to avoid
redundant API calls.  PII fields are decrypted with Cloud KMS before use.

No generated file is persisted to any storage (per ADR-007).
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from bowltie_py import format_error
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from toolbox_py import CorrelationIdMiddleware, get_logger, is_app_error, setup_logging

from app.config import settings
from app.routers import health, resumes

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


def _init_firebase() -> None:
    """Initialise the Firebase Admin SDK (idempotent).

    Uses Application Default Credentials in production (Cloud Run) and the
    explicit service-account JSON key at ``GOOGLE_APPLICATION_CREDENTIALS``
    for local development.
    """
    try:
        import firebase_admin  # type: ignore[import-untyped]
        from firebase_admin import credentials  # type: ignore[import-untyped]

        if firebase_admin._apps:  # already initialised
            return
        project_id = settings.gcp_project_id or "demo-project"
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": project_id})
        logger.debug("Firebase Admin SDK initialised", extra={"project_id": project_id})
    except Exception as exc:
        logger.warning(
            "Firebase Admin SDK initialisation failed — Firestore will be unavailable: %s",
            exc,
        )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown lifecycle hooks for the FastAPI app.

    Initialises Firebase Admin SDK on startup and logs operational parameters.

    Args:
        app: The FastAPI application instance provided by the lifespan protocol.

    Returns:
        Async generator used by FastAPI to delimit startup and shutdown phases.
    """
    logger.info(
        "File Generator service starting up",
        extra={
            "port": settings.port,
            "log_level": settings.log_level,
            "firestore_collection_resumes": settings.firestore_collection_resumes,
            "firestore_collection_translation_cache": (
                settings.firestore_collection_translation_cache
            ),
            "drive_template_file_id": settings.drive_template_file_id or "(not set)",
            "decrypt_kms_key_name": "(configured)" if settings.decrypt_kms_key_name else "(not set)",
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

    _init_firebase()

    yield
    logger.info("File Generator service shutting down")


_OPENAPI_TAGS = [
    {
        "name": "Resumes",
        "description": (
            "Resume file generation endpoints.  Accept a resume ID and optional "
            "language, retrieve structured data from Firestore, render a Jinja2 "
            "``.docx`` template, and return the generated document."
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
    title="File Generator",
    version="1.0.0",
    description=(
        "Resume file generation microservice.  Retrieves structured resume JSON "
        "from Firestore, fetches a Jinja2 ``.docx`` template from Google Drive "
        "using the Bugle shared library, optionally translates content via the "
        "Google Cloud Translation API (with Firestore caching), decrypts PII "
        "fields with Cloud KMS, renders the template, and returns the final "
        "document in the response.  No file is persisted to any storage "
        "(per ADR-007)."
    ),
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/docs/json",
    openapi_tags=_OPENAPI_TAGS,
)

app.add_middleware(CorrelationIdMiddleware)

app.include_router(resumes.router, prefix="/resumes")
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
