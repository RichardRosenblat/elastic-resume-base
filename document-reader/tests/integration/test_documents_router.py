from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.main import app
from app.models.document import DocumentType, ExtractedDocument


@pytest.fixture
def client() -> AsyncClient:
    return AsyncClient(app=app, base_url="http://test")


async def test_health_check(client: AsyncClient) -> None:
    async with client as c:
        response = await c.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ocr_no_files_returns_400(client: AsyncClient) -> None:
    async with client as c:
        response = await c.post("/api/v1/documents/ocr")
    assert response.status_code == 422  # FastAPI validation: required field missing


async def test_ocr_unsupported_file_type(client: AsyncClient) -> None:
    async with client as c:
        response = await c.post(
            "/api/v1/documents/ocr",
            files=[("files", ("document.txt", b"some text content", "text/plain"))],
        )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


async def test_ocr_success(client: AsyncClient, sample_image_bytes: bytes) -> None:
    """Mock OCR and extractor services; assert 200 and Excel response."""
    mock_doc = ExtractedDocument(
        filename="test.png",
        document_type=DocumentType.RG,
        raw_text="REGISTRO GERAL\nNome: Test User",
        extracted_fields={"name": "Test User", "rg_number": "12.345.678-9"},
    )

    with (
        patch("app.routers.documents.OcrService") as mock_ocr_cls,
        patch("app.routers.documents.ExtractorService") as mock_extractor_cls,
    ):
        mock_ocr_instance = mock_ocr_cls.return_value
        mock_ocr_instance.extract_text = AsyncMock(return_value="REGISTRO GERAL\nNome: Test User")
        mock_extractor_instance = mock_extractor_cls.return_value
        mock_extractor_instance.extract = MagicMock(return_value=mock_doc)

        async with client as c:
            response = await c.post(
                "/api/v1/documents/ocr",
                files=[("files", ("test.png", sample_image_bytes, "image/png"))],
            )

    assert response.status_code == 200
    assert (
        response.headers["content-type"]
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert "extracted_documents.xlsx" in response.headers.get("content-disposition", "")


async def test_ocr_file_too_large(client: AsyncClient) -> None:
    """File exceeding max size returns 422."""
    large_content = b"x" * (11 * 1024 * 1024)  # 11 MB > default 10 MB limit

    with patch("app.routers.documents.OcrService"):
        async with client as c:
            response = await c.post(
                "/api/v1/documents/ocr",
                files=[("files", ("big.png", large_content, "image/png"))],
            )

    assert response.status_code == 422
    assert "exceeds maximum size" in response.json()["detail"]
