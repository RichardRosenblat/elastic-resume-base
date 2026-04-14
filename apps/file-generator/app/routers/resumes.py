"""Resume file generation endpoint.

Exposes ``POST /resumes/{resume_id}/generate`` which accepts a generation
request (language, format), retrieves structured resume data from Firestore,
optionally translates it, renders a Jinja2 ``.docx`` template, and returns
the generated document as a base64-encoded string in the JSON response.

No file is persisted to object storage (per ADR-007).  The caller receives
the document content directly in the response body and is responsible for
delivering or downloading it.
"""

from __future__ import annotations

from bowltie_py import format_error, format_success
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from synapse_py import FirestoreResumeStore, initialize_persistence  # type: ignore[import-untyped]
from toolbox_py import get_logger

from app.config import settings
from app.models.generate import GenerateRequest, GenerateResponse
from app.services.file_generator_service import FileGeneratorService
from app.services.translation_service import TranslationService
from app.utils.exceptions import (
    ResumeNotFoundError,
    TemplateNotFoundError,
    TemplateRenderError,
    TranslationError,
)

logger = get_logger(__name__)

router = APIRouter(tags=["Resumes"])

_DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)


def _get_file_generator_service(include_translation: bool = False) -> FileGeneratorService:
    """Create a fully-wired :class:`~app.services.file_generator_service.FileGeneratorService`.

    Initialises Firestore (via Synapse) and assembles the service with the
    configured template source, KMS key, and optional translation service.

    Args:
        include_translation: When ``True``, includes a
            :class:`~app.services.translation_service.TranslationService`.

    Returns:
        A configured :class:`~app.services.file_generator_service.FileGeneratorService`.
    """
    project_id = settings.gcp_project_id or "demo-project"

    initialize_persistence(project_id=project_id)

    translation_service: TranslationService | None = None
    if include_translation:
        translation_service = TranslationService(
            project_id=project_id,
            cache_collection=settings.firestore_collection_translation_cache,
            api_location=settings.translation_api_location,
        )

    return FileGeneratorService(
        resume_store=FirestoreResumeStore(settings.firestore_collection_resumes),
        translation_service=translation_service,
        drive_template_file_id=settings.drive_template_file_id,
        local_template_path=settings.local_template_path,
        decrypt_kms_key_name=settings.decrypt_kms_key_name,
        local_fernet_key=settings.local_fernet_key,
    )


@router.post(
    "/{resume_id}/generate",
    summary="Generate a resume document",
    description=(
        "Fetches structured resume data from Firestore, optionally translates "
        "it using Google Cloud Translation API (with Firestore caching), renders "
        "a Jinja2 ``.docx`` template with the data, and returns the generated "
        "document as a base64-encoded string in the response body.\n\n"
        "No file is persisted to any storage (per ADR-007).  The caller receives "
        "the document content directly and is responsible for download delivery."
    ),
    responses={
        200: {"description": "Document generated successfully."},
        404: {"description": "Resume not found."},
        422: {"description": "Validation error in request body."},
        500: {"description": "Internal error during generation."},
        503: {"description": "Template or upstream service unavailable."},
    },
)
async def generate_resume(
    resume_id: str,
    body: GenerateRequest,
    request: Request,
) -> JSONResponse:
    """Handle ``POST /resumes/{resume_id}/generate``.

    Fetches resume data from Firestore, renders a ``.docx`` template, and
    returns the document as a base64-encoded JSON payload.

    Args:
        resume_id: Firestore document ID of the resume to generate.
        body: Generation parameters (language, format).
        request: The incoming HTTP request (used for correlation ID logging).

    Returns:
        JSONResponse with a Bowltie-formatted payload containing the generated
        document content.
    """
    correlation_id: str = getattr(request.state, "correlation_id", "")

    logger.info(
        "Generate request received",
        extra={
            "resume_id": resume_id,
            "language": body.language,
            "format": body.format,
            "correlation_id": correlation_id,
        },
    )

    # Determine whether translation is needed.
    # We always attempt translation when a language is specified; the translation
    # service itself handles same-language no-ops gracefully.
    include_translation = bool(body.language and body.language.lower() != "")

    try:
        service = _get_file_generator_service(include_translation=include_translation)
        job_id, file_content_b64, mime_type = service.generate(
            resume_id=resume_id,
            language=body.language,
            format=body.format,
        )
    except ResumeNotFoundError:
        logger.warning(
            "Resume not found",
            extra={"resume_id": resume_id, "correlation_id": correlation_id},
        )
        return JSONResponse(
            status_code=404,
            content=format_error("NOT_FOUND", f"Resume '{resume_id}' not found."),
        )
    except TemplateNotFoundError as exc:
        logger.error(
            "Template not available",
            extra={
                "resume_id": resume_id,
                "error": str(exc),
                "correlation_id": correlation_id,
            },
        )
        return JSONResponse(
            status_code=503,
            content=format_error("SERVICE_UNAVAILABLE", "Resume template is not available."),
        )
    except TemplateRenderError as exc:
        logger.error(
            "Template rendering failed",
            extra={
                "resume_id": resume_id,
                "error": str(exc),
                "correlation_id": correlation_id,
            },
        )
        return JSONResponse(
            status_code=500,
            content=format_error("INTERNAL_ERROR", "Failed to render resume template."),
        )
    except TranslationError as exc:
        logger.error(
            "Translation failed",
            extra={
                "resume_id": resume_id,
                "error": str(exc),
                "correlation_id": correlation_id,
            },
        )
        return JSONResponse(
            status_code=500,
            content=format_error("INTERNAL_ERROR", "Translation service failed."),
        )
    except Exception as exc:
        logger.exception(
            "Unexpected error during file generation",
            extra={"resume_id": resume_id, "correlation_id": correlation_id},
        )
        return JSONResponse(
            status_code=500,
            content=format_error("INTERNAL_ERROR", "An unexpected error occurred."),
        )

    response = GenerateResponse(
        jobId=job_id,
        status="completed",
        fileContent=file_content_b64,
        mimeType=mime_type,
        filename=f"resume-{resume_id}.docx",
    )

    logger.info(
        "Generate request completed",
        extra={
            "resume_id": resume_id,
            "job_id": job_id,
            "correlation_id": correlation_id,
        },
    )

    return JSONResponse(
        status_code=200,
        content=format_success(response.model_dump(by_alias=True)),
    )
