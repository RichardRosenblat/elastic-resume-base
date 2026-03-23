import io
import logging
import os
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.config import settings
from app.document_schema import ALLOWED_FILE_EXTENSIONS
from app.services.excel_service import ExcelService
from app.services.extractor_service import ExtractorService
from app.services.ocr_service import OcrService
from app.services.zip_service import ZipService
from app.utils.exceptions import OcrServiceError, UnsupportedFileTypeError, ZipExtractionError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Documents"])

# Extensions that can be processed directly by OCR — sourced from the document schema.
ALLOWED_EXTENSIONS: frozenset[str] = ALLOWED_FILE_EXTENSIONS

# Extensions accepted at the upload boundary (adds ZIP on top of direct OCR types).
ACCEPTED_UPLOAD_EXTENSIONS: frozenset[str] = ALLOWED_EXTENSIONS | frozenset({".zip"})

MAX_FILE_SIZE_BYTES = settings.max_file_size_mb * 1024 * 1024


@router.post("/documents/ocr")
async def ocr_documents(
    files: Annotated[list[UploadFile], File(description="Documents to process with OCR")],
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

    for upload_file in files:
        filename = upload_file.filename or "unknown"
        ext = _get_extension(filename)

        if ext not in ACCEPTED_UPLOAD_EXTENSIONS:
            allowed = ", ".join(sorted(ACCEPTED_UPLOAD_EXTENSIONS))
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Allowed: {allowed}",
            )

        content = await upload_file.read()

        if len(content) > MAX_FILE_SIZE_BYTES:
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
            validated.append((filename, ext, content))

    ocr_service = OcrService()
    extractor_service = ExtractorService()
    excel_service = ExcelService()
    extracted_documents = []

    for filename, ext, content in validated:
        logger.info("Processing file", extra={"doc_filename": filename})
        try:
            raw_text = await ocr_service.extract_text(content, ext)
            doc = extractor_service.extract(filename, raw_text)
            extracted_documents.append(doc)

        except UnsupportedFileTypeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except OcrServiceError as exc:
            logger.error("OCR failed for file", extra={"doc_filename": filename, "error": str(exc)})
            raise HTTPException(status_code=502, detail="OCR processing failed") from exc

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
