"""DLQ Notifier service application entrypoint."""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from bowltie_py import format_error
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from toolbox_py import CorrelationIdMiddleware, get_logger, is_app_error, setup_logging

from app.config import settings
from app.routers import health, notifications, pubsub

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
        project_id = settings.effective_project_id
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": project_id})
        logger.debug("Firebase Admin SDK initialised", extra={"project_id": project_id})
    except Exception as exc:
        logger.warning(
            "Firebase Admin SDK initialisation failed — Firestore storage will be unavailable: %s",
            exc,
        )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown lifecycle hooks."""
    logger.info(
        "DLQ Notifier service starting up",
        extra={
            "port": settings.port,
            "log_level": settings.log_level,
            "pubsub_topic_dlq": settings.pubsub_topic_dlq,
            "notification_recipients": settings.notification_recipients,
            "firestore_collection": settings.firestore_collection_notifications,
        },
    )

    # Initialise Firebase Admin SDK for Firestore access.
    _init_firebase()

    # Initialise Hermes messaging layer if SMTP is configured.
    if settings.smtp_host and settings.smtp_from:
        try:
            from hermes_py import MessagingOptions, initialize_messaging

            initialize_messaging(
                MessagingOptions(
                    host=settings.smtp_host,
                    port=settings.smtp_port,
                    secure=settings.smtp_secure,
                    user=settings.smtp_user or None,
                    password=settings.smtp_password or None,
                    from_address=settings.smtp_from,
                )
            )
            logger.debug("Hermes messaging layer initialised.")
        except Exception as exc:
            logger.warning("Hermes messaging initialisation failed: %s", exc)
    else:
        logger.warning(
            "SMTP not configured (SMTP_HOST / SMTP_FROM are empty). "
            "Email notifications will not be sent."
        )

    yield
    logger.info("DLQ Notifier service shutting down")


_OPENAPI_TAGS = [
    {
        "name": "Pub/Sub",
        "description": (
            "Push endpoint for Google Cloud Pub/Sub messages.  Receives "
            "dead-letter messages from the ``dead-letter-queue`` subscription, "
            "persists them to Firestore, and dispatches email alerts."
        ),
    },
    {
        "name": "Notifications",
        "description": (
            "REST API for reading and managing DLQ notifications.  Proxied by "
            "the Gateway API which injects user identity headers."
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
    title="DLQ Notifier",
    version="1.0.0",
    description=(
        "Dead-Letter Queue notifier microservice.  Subscribes to the "
        "``dead-letter-queue`` Pub/Sub topic via push subscription, persists "
        "notification records to Firestore, and dispatches email alerts to the "
        "configured recipients for manual investigation and re-processing."
    ),
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/docs/json",
    openapi_tags=_OPENAPI_TAGS,
)

app.add_middleware(CorrelationIdMiddleware)

app.include_router(pubsub.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(health.router, prefix="/health")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle FastAPI HTTP exceptions and format them using Bowltie."""
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
    """Handle unhandled exceptions and format them using Bowltie."""
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
