import io
import os
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from toolbox_py import RateLimitError, get_logger

from app.config import settings
from app.dependencies import check_api_rate_limit
from app.document_schema import ALLOWED_FILE_EXTENSIONS
from app.models.document import ExtractedDocument
from app.services.excel_service import ExcelService
from app.services.extractor_service import ExtractorService
from app.services.ocr_service import OcrService
from app.services.zip_service import ZipService
from app.utils.exceptions import OcrServiceError, UnsupportedFileTypeError, ZipExtractionError

logger = get_logger(__name__)

router = APIRouter(tags=["Documents"], dependencies=[Depends(check_api_rate_limit)])

# Extensions that can be processed directly by OCR — sourced from the document schema.
ALLOWED_EXTENSIONS: frozenset[str] = ALLOWED_FILE_EXTENSIONS

# Extensions accepted at the upload boundary (adds ZIP on top of direct OCR types).
ACCEPTED_UPLOAD_EXTENSIONS: frozenset[str] = ALLOWED_EXTENSIONS | frozenset({".zip"})

MAX_FILE_SIZE_BYTES = settings.max_file_size_mb * 1024 * 1024

_ENDPOINT_DESCRIPTION = f"""
Process uploaded files with **Google Cloud Vision OCR** and extract structured
fields from recognized Brazilian document types.

---

### Accepted file formats

Upload individual files or `.zip` archives (or a mix of both).
The request **must** use `Content-Type: multipart/form-data` and include the
`files` form field with one or more file parts.

| Format | Accepted directly | Inside a `.zip` |
|--------|:-----------------:|:---------------:|
| `.pdf` | ✅ | ✅ |
| `.docx` | ✅ | ✅ |
| `.jpg` / `.jpeg` | ✅ | ✅ |
| `.png` | ✅ | ✅ |
| `.tiff` / `.tif` | ✅ | ✅ |
| `.bmp` | ✅ | ✅ |
| `.webp` | ✅ | ✅ |
| `.zip` | ✅ | ❌ (no nested archives) |

ZIP archives are expanded server-side; each entry is validated individually.

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
            "description": (
                "Unsupported file type uploaded, or a ZIP archive is invalid / "
                "contains no supported documents."
            ),
            "content": {"application/json": {"schema": _BOWLTIE_ERROR_SCHEMA}},
        },
        422: {
            "description": (
                "A file (or ZIP entry) exceeds the configured maximum size limit "
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
                "`.zip` archives are also accepted and automatically expanded "
                "server-side — each entry inside the archive is validated "
                "individually against the same format list.  "
                f"Maximum size per file: {settings.max_file_size_mb} MB."
            )
        ),
    ],
) -> StreamingResponse:
    """Process uploaded documents with OCR and return extracted data as Excel file.

    Accepts individual document files **or** ZIP archives (or a mixture of both).
    When a ``.zip`` file is uploaded every supported document it contains is
    extracted and processed — the archive itself is never persisted.

    Args:
        files: One or more uploaded files.  Supported direct formats:
            ``.pdf``, ``.jpg``, ``.jpeg``, ``.png``, ``.tiff``, ``.tif``,
            ``.bmp``, ``.webp``, ``.docx``.  ZIP archives (``.zip``) may
            contain any mix of the above formats.

    Returns:
        StreamingResponse containing an Excel file with extracted document data.

    Raises:
        HTTPException 400: If an unsupported file type is uploaded or a ZIP
            archive is invalid / contains no supported documents.
        HTTPException 422: If a file (or a ZIP entry) exceeds the maximum
            allowed size.
        HTTPException 502: If the OCR service fails to process a file.
    """
    zip_service = ZipService()

    # First pass: validate uploads and expand any ZIP archives.
    # Result: a flat list of (filename, extension, content) ready for OCR.
    validated: list[tuple[str, str, bytes]] = []

    logger.debug(
        "Received OCR request",
        extra={"file_count": len(files)},
    )

    for upload_file in files:
        filename = upload_file.filename or "unknown"
        ext = _get_extension(filename)

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

        if ext == ".zip":
            logger.info("Expanding ZIP archive", extra={"zip_filename": filename})
            try:
                entries = zip_service.extract(
                    content,
                    frozenset(ALLOWED_EXTENSIONS),
                    MAX_FILE_SIZE_BYTES,
                )
            except ZipExtractionError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            validated.extend(entries)
            logger.info(
                "ZIP archive expanded",
                extra={"zip_filename": filename, "entry_count": len(entries)},
            )
        else:
            logger.debug(
                "File accepted for OCR",
                extra={"doc_filename": filename, "size_bytes": len(content)},
            )
            validated.append((filename, ext, content))

    logger.info(
        "Starting OCR processing",
        extra={"total_files": len(validated)},
    )

    ocr_service = OcrService()
    extractor_service = ExtractorService()
    excel_service = ExcelService()
    extracted_documents: list[ExtractedDocument] = []

    for filename, ext, content in validated:
        logger.info("Processing file", extra={"doc_filename": filename})
        try:
            raw_text = await ocr_service.extract_text(content, ext)
            doc = extractor_service.extract(filename, raw_text)
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
