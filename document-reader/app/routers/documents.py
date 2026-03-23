import io
import logging
import os
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.config import settings
from app.services.excel_service import ExcelService
from app.services.extractor_service import ExtractorService
from app.services.ocr_service import OcrService
from app.utils.exceptions import OcrServiceError, UnsupportedFileTypeError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Documents"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp", ".docx"}
MAX_FILE_SIZE_BYTES = settings.max_file_size_mb * 1024 * 1024


@router.post("/documents/ocr")
async def ocr_documents(
    files: Annotated[list[UploadFile], File(description="Documents to process with OCR")],
) -> StreamingResponse:
    """Process uploaded documents with OCR and return extracted data as Excel file.

    Args:
        files: List of uploaded document files to process.

    Returns:
        StreamingResponse containing an Excel file with extracted document data.

    Raises:
        HTTPException 400: If no files provided or an unsupported file type is uploaded.
        HTTPException 422: If a file exceeds the maximum allowed size.
        HTTPException 502: If the OCR service fails to process a file.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # First pass: validate all files and read content before touching external services
    validated: list[tuple[str, str, bytes]] = []
    for upload_file in files:
        filename = upload_file.filename or "unknown"
        ext = _get_extension(filename)
        if ext not in ALLOWED_EXTENSIONS:
            allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
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
