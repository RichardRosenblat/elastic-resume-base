import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from bowltie_py import format_error
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from toolbox_py import CorrelationIdMiddleware, get_logger, is_app_error, setup_logging

from app.config import settings
from app.routers import documents, health
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
    """Manage application lifespan events."""
    logger.info(
        "Document Reader service starting up",
        extra={
            "port": settings.port,
            "log_level": settings.log_level,
            "max_file_size_mb": settings.max_file_size_mb,
            "rate_limit_per_minute": settings.rate_limit_per_minute,
            "vision_api_rate_limit": settings.vision_api_rate_limit,
            "vision_api_timeout": settings.vision_api_timeout,
            "http_request_timeout": settings.http_request_timeout,
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
    yield
    logger.info("Document Reader service shutting down")


_OPENAPI_TAGS = [
    {
        "name": "Documents",
        "description": (
            "OCR endpoints for uploading Brazilian documents and extracting "
            "structured data.  Accepts images (`.jpg`, `.jpeg`, `.png`, "
            "`.tiff`, `.tif`, `.bmp`, `.webp`), PDF (`.pdf`), Word (`.docx`), "
            "and ZIP archives (`.zip`) containing any of the above.  "
            "Recognised document types: **RG**, **Certidão de Nascimento**, "
            "**Certidão de Casamento**, **CTPS (Carteira de Trabalho)**, "
            "**PIS/PASEP/NIS**, **Comprovante de Residência**, "
            "**Diploma / Histórico Escolar**.  "
            "Results are returned as a downloadable Excel workbook (`.xlsx`)."
        ),
    },
    {
        "name": "Health",
        "description": (
            "Liveness and readiness probes used by container orchestrators "
            "(Cloud Run, Kubernetes) to monitor service health.  "
            "These endpoints are excluded from request-timeout enforcement and "
            "rate limiting."
        ),
    },
]

app = FastAPI(
    title="Document Reader",
    version="1.0.0",
    description=(
        "OCR microservice that extracts structured data from scanned Brazilian "
        "documents using the **Google Cloud Vision API**.\n\n"
        "Upload one or more files to `/api/v1/documents/ocr` and receive a "
        "downloadable Excel workbook (`.xlsx`) whose columns match the fields "
        "defined for each recognized document type "
        "(RG, CTPS, PIS, Certidão de Nascimento, Certidão de Casamento, "
        "Comprovante de Residência, Diploma / Histórico Escolar).\n\n"
        "All file-upload endpoints require `Content-Type: multipart/form-data`."
    ),
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/docs/json",
    openapi_tags=_OPENAPI_TAGS,
)

app.add_middleware(TimeoutMiddleware, timeout_seconds=settings.http_request_timeout)
app.add_middleware(CorrelationIdMiddleware)

app.include_router(documents.router, prefix="/api/v1")
app.include_router(health.router, prefix="/health")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle FastAPI HTTP exceptions and format them using Bowltie.

    Maps the HTTP status code to a machine-readable error code and wraps
    the response in the standard Bowltie error envelope so that all error
    responses share the same shape as the rest of the API.

    Args:
        request: The incoming HTTP request.
        exc: The :class:`~fastapi.HTTPException` raised by a route handler.

    Returns:
        JSONResponse with Bowltie-formatted error envelope.
    """
    # Map HTTP status codes to machine-readable error codes.
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
            extra={"status_code": exc.status_code, "detail": str(exc.detail), "path": request.url.path},
        )
    elif exc.status_code >= 400:
        logger.warning(
            "HTTP client error response",
            extra={"status_code": exc.status_code, "detail": str(exc.detail), "path": request.url.path},
        )
    return JSONResponse(
        status_code=exc.status_code,
        content=format_error(code, str(exc.detail)),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unhandled exceptions and format them using Bowltie.

    Catches all :class:`~toolbox_py.AppError` subclasses (which carry a status
    code and error code) and formats them through Bowltie.  Any other
    unexpected exception is treated as an internal server error.

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

