import asyncio
import io
import logging

from google.api_core.exceptions import GoogleAPIError
from google.cloud import vision

from app.utils.exceptions import OcrServiceError, UnsupportedFileTypeError

logger = logging.getLogger(__name__)


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

        if ext == ".docx":
            return await asyncio.to_thread(self._extract_docx, content)
        elif ext == ".pdf":
            return await asyncio.to_thread(self._extract_pdf, content)
        elif ext in {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp"}:
            return await asyncio.to_thread(self._extract_image, content)
        else:
            raise UnsupportedFileTypeError(f"Unsupported file extension: {extension!r}")

    def _extract_image(self, content: bytes) -> str:
        """Run Vision API text detection on an image.

        Args:
            content: Raw image bytes.

        Returns:
            Extracted text from the image.

        Raises:
            OcrServiceError: If the Vision API returns an error or raises an exception.
        """
        try:
            image = vision.Image(content=content)
            response = self._client.document_text_detection(image=image)
            if response.error.message:
                raise OcrServiceError(f"Vision API error: {response.error.message}")
            return response.full_text_annotation.text or ""
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
            OcrServiceError: If PDF processing or OCR fails.
        """
        try:
            import fitz  # type: ignore[import-untyped]  # pymupdf

            doc = fitz.open(stream=content, filetype="pdf")
            texts: list[str] = []
            for page in doc:
                pix = page.get_pixmap(dpi=200)
                img_bytes = pix.tobytes("png")
                page_text = self._extract_image(img_bytes)
                if page_text:
                    texts.append(page_text)
            doc.close()
            return "\n".join(texts)
        except OcrServiceError:
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

            document = docx.Document(io.BytesIO(content))
            paragraphs = [para.text for para in document.paragraphs if para.text.strip()]
            return "\n".join(paragraphs)
        except Exception as exc:
            logger.error("DOCX processing failed: %s", exc)
            raise OcrServiceError(f"Failed to process DOCX: {exc}") from exc
