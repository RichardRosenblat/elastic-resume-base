import io
from unittest.mock import MagicMock, patch

import pytest
from google.api_core.exceptions import GoogleAPIError

from app.services.ocr_service import OcrService
from app.utils.exceptions import OcrServiceError, UnsupportedFileTypeError


@pytest.fixture
def ocr_service() -> OcrService:
    with patch("app.services.ocr_service.vision.ImageAnnotatorClient"):
        return OcrService()


def test_extract_text_image_success(ocr_service: OcrService, sample_image_bytes: bytes) -> None:
    """Vision API returns text successfully for an image."""
    mock_response = MagicMock()
    mock_response.error.message = ""
    mock_response.full_text_annotation.text = "Sample text"
    ocr_service._client.document_text_detection.return_value = mock_response

    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        ocr_service.extract_text(sample_image_bytes, ".png")
    )
    assert result == "Sample text"


def test_extract_text_image_vision_api_error(
    ocr_service: OcrService, sample_image_bytes: bytes
) -> None:
    """Vision API returns an error message -> OcrServiceError raised."""
    mock_response = MagicMock()
    mock_response.error.message = "API quota exceeded"
    ocr_service._client.document_text_detection.return_value = mock_response

    import asyncio

    with pytest.raises(OcrServiceError, match="Vision API error"):
        asyncio.get_event_loop().run_until_complete(
            ocr_service.extract_text(sample_image_bytes, ".jpg")
        )


def test_extract_text_docx_success(ocr_service: OcrService) -> None:
    """Extract text from a real minimal DOCX in memory."""
    import docx  # type: ignore[import-untyped]

    buffer = io.BytesIO()
    doc = docx.Document()
    doc.add_paragraph("Hello from DOCX")
    doc.save(buffer)
    buffer.seek(0)

    import asyncio

    result = asyncio.get_event_loop().run_until_complete(
        ocr_service.extract_text(buffer.read(), ".docx")
    )
    assert "Hello from DOCX" in result


def test_extract_text_unsupported_extension(ocr_service: OcrService) -> None:
    """Unsupported extension raises UnsupportedFileTypeError."""
    import asyncio

    with pytest.raises(UnsupportedFileTypeError):
        asyncio.get_event_loop().run_until_complete(ocr_service.extract_text(b"data", ".txt"))


def test_extract_text_vision_api_exception(
    ocr_service: OcrService, sample_image_bytes: bytes
) -> None:
    """GoogleAPIError from Vision API is wrapped in OcrServiceError."""
    ocr_service._client.document_text_detection.side_effect = GoogleAPIError("network error")

    import asyncio

    with pytest.raises(OcrServiceError, match="Vision API call failed"):
        asyncio.get_event_loop().run_until_complete(
            ocr_service.extract_text(sample_image_bytes, ".png")
        )
