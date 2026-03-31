import io
import os
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from toolbox_py import RateLimitError, get_logger

from app.config import settings
from app.dependencies import check_api_rate_limit
from app.document_schema import ALLOWED_FILE_EXTENSIONS, MIME_TYPE_TO_EXTENSION
from app.models.document import DocumentType, ExtractedDocument
from app.services.excel_service import ExcelService
from app.services.extractor_service import ExtractorService
from app.services.ocr_service import OcrService
from app.utils.exceptions import OcrServiceError, UnsupportedFileTypeError

logger = get_logger(__name__)

router = APIRouter(tags=["Documents"], dependencies=[Depends(check_api_rate_limit)])

# Extensions that can be processed directly by OCR — sourced from the document schema.
ALLOWED_EXTENSIONS: frozenset[str] = ALLOWED_FILE_EXTENSIONS

# Extensions accepted at the upload boundary.
ACCEPTED_UPLOAD_EXTENSIONS: frozenset[str] = ALLOWED_EXTENSIONS

MAX_FILE_SIZE_BYTES = settings.max_file_size_mb * 1024 * 1024

_ENDPOINT_DESCRIPTION = f"""
Process uploaded files with **Google Cloud Vision OCR** and extract structured
fields from recognized Brazilian document types.

---

### Accepted file formats

The request **must** use `Content-Type: multipart/form-data` and include the
`files` form field with one or more file parts.

| Format | Accepted |
|--------|:--------:|
| `.pdf` | ✅ |
| `.docx` | ✅ |
| `.jpg` / `.jpeg` | ✅ |
| `.png` | ✅ |
| `.tiff` / `.tif` | ✅ |
| `.bmp` | ✅ |
| `.webp` | ✅ |

---

### Explicit document type

The optional `documentTypes` form field allows callers to declare the Brazilian
document type of each uploaded file explicitly, bypassing the keyword-based OCR
classifier.  When provided, `documentTypes` must contain exactly one entry per
file in the `files` field (in the same order).

An empty string in the list is treated as *"auto-detect for this file"*, so
callers may send a full-length list even when only some files have known types.

Supported values:

| Value | Brazilian document |
|-------|-------------------|
| `RG` | Registro Geral (identity card) |
| `BIRTH_CERTIFICATE` | Certidão de Nascimento |
| `MARRIAGE_CERTIFICATE` | Certidão de Casamento |
| `WORK_CARD` | Carteira de Trabalho (CTPS) |
| `PIS` | PIS / PASEP / NIS |
| `PROOF_OF_ADDRESS` | Comprovante de Residência |
| `PROOF_OF_EDUCATION` | Diploma / Histórico Escolar |
| `UNKNOWN` | No structured extraction (treated as unrecognised) |

---

### Recognised document types and extracted fields

| Document type | Portuguese name | Extracted fields |
|---|---|---|
| `RG` | Registro Geral (identity card) | `rg_number`, `name` |
| `BIRTH_CERTIFICATE` | Certidão de Nascimento | `name`, `date_of_birth` |
| `MARRIAGE_CERTIFICATE` | Certidão de Casamento | `name`, `date_of_marriage`, `spouse_name` |
| `WORK_CARD` | Carteira de Trabalho (CTPS) | `issue_date`, `work_card_number` |
| `PIS` | PIS / PASEP / NIS | `pis_number` |
| `PROOF_OF_ADDRESS` | Comprovante de Residência | `address` (street + CEP) |
| `PROOF_OF_EDUCATION` | Diploma / Histórico Escolar | `institution_name`, `year_of_completion` |
| `UNKNOWN` | Unrecognized document | *(no structured fields)* |

---

### Response format

The endpoint returns a streaming **Excel workbook** (`.xlsx`) with one sheet per
recognized document type.  Each row corresponds to one uploaded file (or ZIP
entry); columns map to the extracted fields listed above.

> **Note** — the `Content-Disposition` header is set to
> `attachment; filename=extracted_documents.xlsx` so browsers will offer a
> download prompt automatically.

---

### Constraints

- **Maximum file size per document**: `{settings.max_file_size_mb} MB`
  (configurable via `max_file_size_mb`; HTTP 422 when exceeded).
- **Rate limiting**: at most `{settings.rate_limit_per_minute}` requests per IP per minute;
  excess requests receive HTTP 429.
- **Vision API rate limit**: at most `{settings.vision_api_rate_limit}` Vision API calls per
  minute; exceeded calls also return HTTP 429.
- **Request timeout**: `{settings.http_request_timeout}` seconds per request; long-running
  requests return HTTP 504.
"""

_BOWLTIE_ERROR_SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {
        "success": {"type": "boolean", "example": False},
        "error": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "example": "BAD_REQUEST"},
                "message": {
                    "type": "string",
                    "example": "Human-readable error description",
                },
            },
            "required": ["code", "message"],
        },
        "meta": {
            "type": "object",
            "properties": {
                "correlationId": {
                    "type": "string",
                    "example": "00000000-0000-0000-0000-000000000000",
                },
                "timestamp": {
                    "type": "string",
                    "format": "date-time",
                    "example": "2024-01-01T00:00:00.000Z",
                },
            },
        },
    },
    "required": ["success", "error", "meta"],
}


async def _get_document_types(request: Request) -> list[DocumentType]:
    """Dependency that extracts all ``documentTypes`` form values from the request.

    Reads the multipart form data and returns a list of explicit Brazilian
    document type values provided by the caller (one per uploaded file, in the
    same order).

    ``documentTypes`` is **required** — the field must be present and must
    contain exactly one non-empty, valid :class:`~app.models.document.DocumentType`
    value per uploaded file.

    Using a :func:`~fastapi.Depends` dependency instead of a plain ``Form``
    parameter allows collecting *all* repeated form field values via
    :meth:`~starlette.datastructures.FormData.getlist`, which is necessary when
    multiple files are uploaded in a single request.

    Args:
        request: Incoming request containing multipart form data.

    Returns:
        Ordered list of document types supplied in the ``documentTypes`` form
        field, aligned with uploaded file order.

    Raises:
        HTTPException 422: If the ``documentTypes`` field is absent, if any
            value is an empty string, or if any value is not a valid
            :class:`~app.models.document.DocumentType` string.
    """
    form = await request.form()
    # FormData.getlist returns list[str | UploadFile]; keep only plain strings.
    raw_values: list[str] = [v for v in form.getlist("documentTypes") if isinstance(v, str)]
    if not raw_values:
        raise HTTPException(
            status_code=422,
            detail=(
                "'documentTypes' is required. "
                "Provide one document type value per uploaded file."
            ),
        )

    valid_type_values = {t.value for t in DocumentType}
    # Empty strings are no longer accepted — every file must have an explicit type.
    invalid = [v for v in raw_values if v not in valid_type_values]
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Invalid document type(s): {invalid}. "
                f"Valid values: {sorted(valid_type_values)}"
            ),
        )

    return [DocumentType(v) for v in raw_values]


@router.post(
    "/documents/ocr",
    summary="Extract structured data from Brazilian documents via OCR",
    description=_ENDPOINT_DESCRIPTION,
    response_class=StreamingResponse,
    responses={
        200: {
            "description": (
                "Excel workbook (`.xlsx`) with one sheet per document type.  "
                "Each row represents one processed file; columns correspond to "
                "the extracted fields for that document type."
            ),
            "content": {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
                    "schema": {
                        "type": "string",
                        "format": "binary",
                        "description": "Binary Excel workbook data.",
                    }
                }
            },
            "headers": {
                "Content-Disposition": {
                    "description": (
                        "Always `attachment; filename=extracted_documents.xlsx`"
                    ),
                    "schema": {"type": "string"},
                }
            },
        },
        400: {
            "description": "Unsupported file type uploaded.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        422: {
            "description": (
                "A file exceeds the configured maximum size limit "
                f"(default: {settings.max_file_size_mb} MB), **or** the request "
                "body is structurally invalid (missing required `files` form field)."
            ),
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        429: {
            "description": (
                "Rate limit exceeded — either the per-IP API rate limit or the "
                "Google Cloud Vision API quota has been reached."
            ),
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        502: {
            "description": "The Google Cloud Vision OCR service returned an error.",
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        504: {
            "description": (
                f"Request timed out after {settings.http_request_timeout} seconds "
                "(configurable via `http_request_timeout`)."
            ),
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
    },
)
async def ocr_documents(
    files: Annotated[
        list[UploadFile],
        File(
            description=(
                "One or more documents to process via OCR.  "
                "**Accepted formats**: `.pdf`, `.docx`, `.jpg`, `.jpeg`, "
                "`.png`, `.tiff`, `.tif`, `.bmp`, `.webp`.  "
                f"Maximum size per file: {settings.max_file_size_mb} MB."
            )
        ),
    ],
    document_types: Annotated[list[DocumentType], Depends(_get_document_types)],
) -> StreamingResponse:
    """Process uploaded documents with OCR and return extracted data as Excel file.

    Args:
        files: One or more uploaded files.  Supported formats:
            ``.pdf``, ``.jpg``, ``.jpeg``, ``.png``, ``.tiff``, ``.tif``,
            ``.bmp``, ``.webp``, ``.docx``.
        document_types: Required list of :class:`~app.models.document.DocumentType`
            values, one per file in ``files`` (same order).  Invalid or missing
            values produce a 422 response.

    Returns:
        StreamingResponse containing an Excel file with extracted document data.

    Raises:
        HTTPException 400: If an unsupported file type is uploaded.
        HTTPException 422: If ``documentTypes`` is absent, contains an invalid
            value, a file exceeds the maximum allowed size, or the count of
            ``documentTypes`` does not match the number of uploaded files.
        HTTPException 429: If the Vision API request budget is exceeded.
        HTTPException 502: If the OCR service fails to process a file.
    """
    # Validate that documentTypes has exactly one entry per file.
    if len(document_types) != len(files):
        logger.warning(
            "documentTypes count mismatch",
            extra={"file_count": len(files), "document_types_count": len(document_types)},
        )
        raise HTTPException(
            status_code=422,
            detail=(
                f"'documentTypes' must contain exactly one value per uploaded file "
                f"({len(files)} file(s) uploaded, {len(document_types)} documentTypes value(s) provided)."
            ),
        )

    # First pass: validate uploads.
    # Each tuple is (filename, extension, content, forced_document_type).
    validated: list[tuple[str, str, bytes, DocumentType | None]] = []

    logger.debug(
        "Received OCR request",
        extra={"file_count": len(files)},
    )

    for index, upload_file in enumerate(files):
        filename = upload_file.filename or "unknown"
        ext = _resolve_extension(filename, upload_file.content_type, None)

        logger.debug(
            "Validating uploaded file",
            extra={"doc_filename": filename, "extension": ext},
        )

        if ext not in ACCEPTED_UPLOAD_EXTENSIONS:
            allowed = ", ".join(sorted(ACCEPTED_UPLOAD_EXTENSIONS))
            logger.warning(
                "Rejected unsupported file type",
                extra={"doc_filename": filename, "extension": ext},
            )
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Allowed: {allowed}",
            )

        content = await upload_file.read()

        if len(content) > MAX_FILE_SIZE_BYTES:
            logger.warning(
                "Rejected file exceeding size limit",
                extra={
                    "doc_filename": filename,
                    "size_bytes": len(content),
                    "limit_bytes": MAX_FILE_SIZE_BYTES,
                },
            )
            raise HTTPException(
                status_code=422,
                detail=f"File '{filename}' exceeds maximum size of {settings.max_file_size_mb} MB",
            )

        forced_type = document_types[index]
        logger.debug(
            "File accepted for OCR",
            extra={"doc_filename": filename, "size_bytes": len(content)},
        )
        validated.append((filename, ext, content, forced_type))

    logger.info(
        "Starting OCR processing",
        extra={"total_files": len(validated)},
    )

    ocr_service = OcrService()
    extractor_service = ExtractorService()
    excel_service = ExcelService()
    extracted_documents: list[ExtractedDocument] = []

    for filename, ext, content, forced_type in validated:
        logger.info("Processing file", extra={"doc_filename": filename})
        try:
            raw_text = await ocr_service.extract_text(content, ext)
            doc = extractor_service.extract(filename, raw_text, forced_type=forced_type)
            extracted_documents.append(doc)
            logger.info(
                "File processed successfully",
                extra={
                    "doc_filename": filename,
                    "doc_type": doc.document_type.value,
                    "fields_populated": sum(
                        1 for v in doc.extracted_fields.values() if v is not None
                    ),
                },
            )

        except UnsupportedFileTypeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RateLimitError as exc:
            raise HTTPException(status_code=429, detail=exc.message) from exc
        except OcrServiceError as exc:
            logger.error("OCR failed for file", extra={"doc_filename": filename, "error": str(exc)})
            raise HTTPException(status_code=502, detail="OCR processing failed") from exc

    logger.info(
        "OCR request complete",
        extra={"total_documents": len(extracted_documents)},
    )

    excel_bytes = excel_service.generate(extracted_documents)

    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=extracted_documents.xlsx"},
    )


def _get_extension(filename: str) -> str:
    """Return lowercase file extension including the dot.

    Args:
        filename: The name of the file.

    Returns:
        Lowercase file extension including the leading dot (e.g. '.pdf').
    """
    _, ext = os.path.splitext(filename)
    return ext.lower()


def _resolve_extension(
    filename: str,
    content_type: str | None,
    explicit_mime: str | None = None,
) -> str:
    """Resolve a file's extension using MIME type hints with filename fallback.

    Resolution priority:

    1. ``explicit_mime`` — optional caller-supplied MIME type, if recognised in
       :data:`~app.document_schema.MIME_TYPE_TO_EXTENSION`.
    2. ``content_type`` — MIME type from the multipart part ``Content-Type``
       header (populated automatically by browsers), if recognised.
    3. Filename extension via :func:`_get_extension` as a last-resort fallback.

    Parameters that are ``None`` or empty, or whose MIME type is not in the
    mapping, are silently skipped and the next priority level is tried.

    Args:
        filename: Uploaded file name (used as last-resort fallback).
        content_type: MIME type from the multipart part ``Content-Type`` header.
        explicit_mime: Optional caller-supplied MIME type.  Defaults to ``None``.

    Returns:
        Lowercase file extension including the leading dot (e.g. ``'.pdf'``).
    """
    for mime in (explicit_mime, content_type):
        if mime:
            normalized = mime.split(";")[0].strip().lower()
            mapped = MIME_TYPE_TO_EXTENSION.get(normalized)
            if mapped:
                return mapped
    return _get_extension(filename)
