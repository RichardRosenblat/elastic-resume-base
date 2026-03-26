import asyncio
import io
from typing import cast

from google.api_core.exceptions import GoogleAPIError
from google.cloud import vision
from toolbox_py import RateLimitError, get_logger

from app.config import settings
from app.document_schema import IMAGE_EXTENSIONS
from app.utils.exceptions import OcrServiceError, UnsupportedFileTypeError
from app.utils.rate_limiter import RateLimiter

logger = get_logger(__name__)

# Module-level singleton so the budget is shared across all OcrService instances.
_vision_api_rate_limiter = RateLimiter(
    max_calls=settings.vision_api_rate_limit,
    window_seconds=60,
)

_VISION_RATE_LIMIT_MESSAGE = (
    "The system cannot process your request at this time due to high demand. "
    "If this problem persists, please contact support."
)


class OcrService:
    """Service for extracting text from documents using Google Cloud Vision API."""

    def __init__(self) -> None:
        self._client = vision.ImageAnnotatorClient()

    async def extract_text(self, content: bytes, extension: str) -> str:
        """Extract text from document bytes.

        Args:
            content: Raw file bytes.
            extension: File extension (e.g. '.pdf', '.jpg').

        Returns:
            Extracted plain text.

        Raises:
            OcrServiceError: If the Vision API call fails.
            UnsupportedFileTypeError: If the file type is not supported.
        """
        ext = extension.lower()
        logger.debug(
            "Starting text extraction",
            extra={"extension": ext, "content_size_bytes": len(content)},
        )

        if ext == ".docx":
            text = await asyncio.to_thread(self._extract_docx, content)
        elif ext == ".pdf":
            text = await asyncio.to_thread(self._extract_pdf, content)
        elif ext in IMAGE_EXTENSIONS:
            text = await asyncio.to_thread(self._extract_image, content)
        else:
            logger.warning(
                "Unsupported file extension requested",
                extra={"extension": extension},
            )
            raise UnsupportedFileTypeError(f"Unsupported file extension: {extension!r}")

        logger.debug(
            "Text extraction complete",
            extra={"extension": ext, "extracted_chars": len(text)},
        )
        return text

    def _extract_image(self, content: bytes) -> str:
        """Run Vision API text detection on an image.

        Args:
            content: Raw image bytes.

        Returns:
            Extracted text from the image.

        Raises:
            RateLimitError: If the Vision API rate limit has been reached.
            OcrServiceError: If the Vision API returns an error or raises an exception.
        """
        if not _vision_api_rate_limiter.is_allowed():
            logger.warning("Vision API rate limit reached")
            raise RateLimitError(_VISION_RATE_LIMIT_MESSAGE)
        try:
            logger.debug(
                "Calling Vision API for image OCR",
                extra={
                    "content_size_bytes": len(content),
                    "timeout_seconds": settings.vision_api_timeout,
                },
            )
            image = vision.Image(content=content)
            response = self._client.document_text_detection(  # type: ignore[attr-defined]
                image=image,
                timeout=settings.vision_api_timeout,
            )
            if response.error.message:  # type: ignore[union-attr]
                logger.warning(
                    "Vision API returned an error",
                    extra={"api_error": response.error.message},  # type: ignore[union-attr]
                )
                raise OcrServiceError(
                    f"Vision API error: {response.error.message}"  # type: ignore[union-attr]
                )
            extracted = str(response.full_text_annotation.text or "")  # type: ignore[union-attr]
            logger.debug(
                "Vision API OCR succeeded",
                extra={"extracted_chars": len(extracted)},
            )
            return extracted
        except GoogleAPIError as exc:
            logger.error("Vision API call failed: %s", exc)
            raise OcrServiceError(f"Vision API call failed: {exc}") from exc

    def _extract_pdf(self, content: bytes) -> str:
        """Render PDF pages as images and run OCR on each.

        Args:
            content: Raw PDF bytes.

        Returns:
            Concatenated text from all pages.

        Raises:
            RateLimitError: If the Vision API rate limit is reached during page processing.
            OcrServiceError: If PDF processing or OCR fails.
        """
        try:
            import fitz  # type: ignore[import-untyped]  # pymupdf

            doc = fitz.open(stream=content, filetype="pdf")
            page_count: int = int(doc.page_count)  # type: ignore[union-attr]
            logger.debug("Processing PDF", extra={"page_count": page_count})
            texts: list[str] = []
            for page_index in range(page_count):
                page = doc[page_index]  # type: ignore[index]
                logger.debug(
                    "Processing PDF page",
                    extra={"page_index": page_index, "page_count": page_count},
                )
                pix = page.get_pixmap(dpi=200)  # type: ignore[union-attr]
                img_bytes = cast(bytes, pix.tobytes("png"))  # type: ignore[union-attr]
                page_text = self._extract_image(img_bytes)
                if page_text:
                    texts.append(page_text)
            doc.close()
            logger.debug(
                "PDF processing complete",
                extra={"pages_with_text": len(texts), "total_pages": page_count},
            )
            return "\n".join(texts)
        except (OcrServiceError, RateLimitError):
            raise
        except Exception as exc:
            logger.error("PDF processing failed: %s", exc)
            raise OcrServiceError(f"Failed to process PDF: {exc}") from exc

    def _extract_docx(self, content: bytes) -> str:
        """Extract text from DOCX using python-docx.

        Args:
            content: Raw DOCX bytes.

        Returns:
            Extracted text with paragraphs joined by newlines.

        Raises:
            OcrServiceError: If DOCX processing fails.
        """
        try:
            import docx  # type: ignore[import-untyped]

            logger.debug("Processing DOCX", extra={"content_size_bytes": len(content)})
            document = docx.Document(io.BytesIO(content))
            paragraphs = [para.text for para in document.paragraphs if para.text.strip()]
            logger.debug(
                "DOCX processing complete",
                extra={"paragraph_count": len(paragraphs)},
            )
            return "\n".join(paragraphs)
        except Exception as exc:
            logger.error("DOCX processing failed: %s", exc)
            raise OcrServiceError(f"Failed to process DOCX: {exc}") from exc
