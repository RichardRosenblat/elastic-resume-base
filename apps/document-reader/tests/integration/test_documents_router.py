"""Integration tests for the document-reader API endpoints.

Uses the FastAPI test client (via ASGI transport) so the full request/response
pipeline is exercised without starting a real HTTP server.
"""

import io
import zipfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.document import DocumentType, ExtractedDocument

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_zip(entries: dict[str, bytes]) -> bytes:
    """Build an in-memory ZIP archive from a {name: content} mapping."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_STORED) as zf:
        for name, data in entries.items():
            zf.writestr(name, data)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> AsyncClient:
    """Return an AsyncClient using ASGI transport (compatible with newer httpx)."""
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_health_live(client: AsyncClient) -> None:
    """Liveness probe returns Bowltie-formatted success with status ok."""
    async with client as c:
        response = await c.get("/health/live")
    assert response.status_code == 200
    body = response.json()
    # Bowltie envelope
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert "timestamp" in body["meta"]


async def test_health_ready(client: AsyncClient) -> None:
    """Readiness probe returns Bowltie-formatted success with status ok."""
    async with client as c:
        response = await c.get("/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert "timestamp" in body["meta"]


async def test_ocr_no_files_returns_422(client: AsyncClient) -> None:
    """Posting to /documents/ocr without any files returns 422 (FastAPI validation)."""
    async with client as c:
        response = await c.post("/api/v1/documents/ocr")
    assert response.status_code == 422  # FastAPI validation: required field missing


async def test_ocr_unsupported_file_type(client: AsyncClient) -> None:
    async with client as c:
        response = await c.post(
            "/api/v1/documents/ocr",
            data={"documentTypes": "RG"},
            files=[("files", ("document.txt", b"some text content", "text/plain"))],
        )
    assert response.status_code == 400
    body = response.json()
    # Bowltie error envelope
    assert body["success"] is False
    assert "Unsupported file type" in body["error"]["message"]


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
                data={"documentTypes": "RG"},
                files=[("files", ("test.png", sample_image_bytes, "image/png"))],
            )

    assert response.status_code == 200
    assert (
        response.headers["content-type"]
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert "extracted_documents.xlsx" in response.headers.get("content-disposition", "")


async def test_ocr_file_too_large(client: AsyncClient) -> None:
    """File exceeding max size returns 422 with Bowltie error envelope."""
    large_content = b"x" * (11 * 1024 * 1024)  # 11 MB > default 10 MB limit

    with patch("app.routers.documents.OcrService"):
        async with client as c:
            response = await c.post(
                "/api/v1/documents/ocr",
                data={"documentTypes": "RG"},
                files=[("files", ("big.png", large_content, "image/png"))],
            )

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert "exceeds maximum size" in body["error"]["message"]


# ---------------------------------------------------------------------------
# ZIP tests
# ---------------------------------------------------------------------------


async def test_ocr_zip_success(client: AsyncClient, sample_image_bytes: bytes) -> None:
    """ZIP archive containing a supported image is expanded and processed."""
    zip_bytes = _make_zip({"rg.png": sample_image_bytes})

    mock_doc = ExtractedDocument(
        filename="rg.png",
        document_type=DocumentType.RG,
        raw_text="REGISTRO GERAL\nNome: Test User",
        extracted_fields={"name": "Test User", "rg_number": "12.345.678-9"},
    )

    with (
        patch("app.routers.documents.OcrService") as mock_ocr_cls,
        patch("app.routers.documents.ExtractorService") as mock_extractor_cls,
    ):
        mock_ocr_cls.return_value.extract_text = AsyncMock(
            return_value="REGISTRO GERAL\nNome: Test User"
        )
        mock_extractor_cls.return_value.extract = MagicMock(return_value=mock_doc)

        async with client as c:
            response = await c.post(
                "/api/v1/documents/ocr",
                data={"documentTypes": "RG"},
                files=[("files", ("documents.zip", zip_bytes, "application/zip"))],
            )

    assert response.status_code == 200
    assert (
        response.headers["content-type"]
        == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


async def test_ocr_zip_multiple_entries(client: AsyncClient, sample_image_bytes: bytes) -> None:
    """ZIP with multiple supported files produces one Excel row per document."""
    zip_bytes = _make_zip(
        {
            "rg.png": sample_image_bytes,
            "ctps.png": sample_image_bytes,
        }
    )

    mock_doc = ExtractedDocument(
        filename="rg.png",
        document_type=DocumentType.RG,
        raw_text="REGISTRO GERAL",
        extracted_fields={},
    )

    with (
        patch("app.routers.documents.OcrService") as mock_ocr_cls,
        patch("app.routers.documents.ExtractorService") as mock_extractor_cls,
        patch("app.routers.documents.ExcelService") as mock_excel_cls,
    ):
        mock_ocr_cls.return_value.extract_text = AsyncMock(return_value="REGISTRO GERAL")
        mock_extractor_cls.return_value.extract = MagicMock(return_value=mock_doc)
        mock_excel_cls.return_value.generate = MagicMock(return_value=b"fake-excel")

        async with client as c:
            response = await c.post(
                "/api/v1/documents/ocr",
                data={"documentTypes": "RG"},
                files=[("files", ("docs.zip", zip_bytes, "application/zip"))],
            )

    assert response.status_code == 200
    # generate() should have been called with 2 documents
    mock_excel_cls.return_value.generate.assert_called_once()
    call_args = mock_excel_cls.return_value.generate.call_args[0][0]
    assert len(call_args) == 2


async def test_ocr_zip_no_supported_contents(client: AsyncClient) -> None:
    """ZIP containing only unsupported file types returns 400 with Bowltie error."""
    zip_bytes = _make_zip({"notes.txt": b"just text", "data.csv": b"a,b,c"})

    async with client as c:
        response = await c.post(
            "/api/v1/documents/ocr",
            data={"documentTypes": "RG"},
            files=[("files", ("docs.zip", zip_bytes, "application/zip"))],
        )

    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert "no supported document files" in body["error"]["message"]


async def test_ocr_zip_invalid_archive(client: AsyncClient) -> None:
    """Bytes that are not a valid ZIP file return 400 with Bowltie error."""
    async with client as c:
        response = await c.post(
            "/api/v1/documents/ocr",
            data={"documentTypes": "RG"},
            files=[("files", ("bad.zip", b"this is not a zip", "application/zip"))],
        )

    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert "Invalid ZIP archive" in body["error"]["message"]


async def test_ocr_zip_entry_too_large(client: AsyncClient, sample_image_bytes: bytes) -> None:
    """ZipExtractionError for an oversized entry surfaces as 400 with Bowltie error."""
    from app.utils.exceptions import ZipExtractionError

    zip_bytes = _make_zip({"doc.jpg": sample_image_bytes})

    with patch("app.routers.documents.ZipService") as mock_zip_cls:
        mock_zip_cls.return_value.extract.side_effect = ZipExtractionError(
            "Entry 'doc.jpg' in ZIP exceeds the maximum allowed size of 10 MB"
        )
        async with client as c:
            response = await c.post(
                "/api/v1/documents/ocr",
                data={"documentTypes": "RG"},
                files=[("files", ("docs.zip", zip_bytes, "application/zip"))],
            )

    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert "exceeds the maximum allowed size" in body["error"]["message"]


async def test_ocr_mixed_direct_and_zip(client: AsyncClient, sample_image_bytes: bytes) -> None:
    """Direct uploads and ZIP archives can be combined in a single request."""
    zip_bytes = _make_zip({"cert.png": sample_image_bytes})

    mock_doc = ExtractedDocument(
        filename="doc.png",
        document_type=DocumentType.UNKNOWN,
        raw_text="",
        extracted_fields={},
    )

    with (
        patch("app.routers.documents.OcrService") as mock_ocr_cls,
        patch("app.routers.documents.ExtractorService") as mock_extractor_cls,
        patch("app.routers.documents.ExcelService") as mock_excel_cls,
    ):
        mock_ocr_cls.return_value.extract_text = AsyncMock(return_value="")
        mock_extractor_cls.return_value.extract = MagicMock(return_value=mock_doc)
        mock_excel_cls.return_value.generate = MagicMock(return_value=b"fake-excel")

        async with client as c:
            response = await c.post(
                "/api/v1/documents/ocr",
                data={"documentTypes": ["RG", "RG"]},
                files=[
                    ("files", ("direct.png", sample_image_bytes, "image/png")),
                    ("files", ("archive.zip", zip_bytes, "application/zip")),
                ],
            )

    assert response.status_code == 200
    # Two documents: one direct + one from ZIP
    call_args = mock_excel_cls.return_value.generate.call_args[0][0]
    assert len(call_args) == 2


# ---------------------------------------------------------------------------
# Rate limiting tests
# ---------------------------------------------------------------------------


async def test_api_rate_limit_returns_429(sample_image_bytes: bytes) -> None:
    """Exceeding the per-IP API rate limit returns HTTP 429 with Bowltie envelope."""
    from app.dependencies import _api_rate_limiters, _reset_rate_limiters_for_testing
    from app.utils.rate_limiter import RateLimiter

    # Inject an exhausted rate limiter for the test client IP.
    # ASGITransport uses 127.0.0.1 as the client address.
    _reset_rate_limiters_for_testing()
    exhausted = RateLimiter(max_calls=0, window_seconds=60)
    _api_rate_limiters["127.0.0.1"] = exhausted

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            response = await c.post(
                "/api/v1/documents/ocr",
                files=[("files", ("test.png", sample_image_bytes, "image/png"))],
            )
    finally:
        _reset_rate_limiters_for_testing()

    assert response.status_code == 429
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert "exceeded the maximum number of requests" in body["error"]["message"]
    assert "try again later" in body["error"]["message"]


async def test_vision_api_rate_limit_returns_429(sample_image_bytes: bytes) -> None:
    """Exceeding the Vision API rate limit returns HTTP 429 with Bowltie envelope."""
    from toolbox_py import RateLimitError

    with (
        patch("app.routers.documents.OcrService") as mock_ocr_cls,
    ):
        mock_ocr_cls.return_value.extract_text = AsyncMock(
            side_effect=RateLimitError(
                "The system cannot process your request at this time due to high demand. "
                "If this problem persists, please contact support."
            )
        )

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            response = await c.post(
                "/api/v1/documents/ocr",
                data={"documentTypes": "RG"},
                files=[("files", ("test.png", sample_image_bytes, "image/png"))],
            )

    assert response.status_code == 429
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert "contact support" in body["error"]["message"]


async def test_health_endpoints_bypass_rate_limit() -> None:
    """Health endpoints are never blocked by the API rate limiter."""
    from app.dependencies import _api_rate_limiters, _reset_rate_limiters_for_testing
    from app.utils.rate_limiter import RateLimiter

    # Rate-limit the test client IP — health endpoints should still be reachable
    # because they don't use the check_api_rate_limit dependency.
    _reset_rate_limiters_for_testing()
    exhausted = RateLimiter(max_calls=0, window_seconds=60)
    _api_rate_limiters["127.0.0.1"] = exhausted

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            live_response = await c.get("/health/live")
            ready_response = await c.get("/health/ready")
    finally:
        _reset_rate_limiters_for_testing()

    assert live_response.status_code == 200
    assert ready_response.status_code == 200


# ---------------------------------------------------------------------------
# Explicit documentTypes field tests
# ---------------------------------------------------------------------------


async def test_ocr_document_types_count_mismatch_returns_422(
    client: AsyncClient, sample_image_bytes: bytes
) -> None:
    """Providing more documentTypes entries than files returns 422."""
    async with client as c:
        # One file but two documentTypes — counts don't match
        response = await c.post(
            "/api/v1/documents/ocr",
            data={"documentTypes": ["RG", "BIRTH_CERTIFICATE"]},
            files=[("files", ("photo.png", sample_image_bytes, "image/png"))],
        )
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert "documentTypes" in body["error"]["message"]


async def test_ocr_invalid_document_type_returns_422(
    client: AsyncClient, sample_image_bytes: bytes
) -> None:
    """Providing an unrecognised documentTypes value returns 422."""
    async with client as c:
        response = await c.post(
            "/api/v1/documents/ocr",
            data={"documentTypes": "INVALID_TYPE"},
            files=[("files", ("photo.png", sample_image_bytes, "image/png"))],
        )
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert "INVALID_TYPE" in body["error"]["message"]


async def test_ocr_explicit_document_type_bypasses_detection(
    client: AsyncClient, sample_image_bytes: bytes
) -> None:
    """Providing documentTypes forces a specific type, bypassing keyword detection."""
    mock_doc = ExtractedDocument(
        filename="photo.png",
        document_type=DocumentType.RG,
        raw_text="",
        extracted_fields={"name": None, "rg_number": None},
    )

    with (
        patch("app.routers.documents.OcrService") as mock_ocr_cls,
        patch("app.routers.documents.ExtractorService") as mock_extractor_cls,
    ):
        mock_ocr_cls.return_value.extract_text = AsyncMock(return_value="")
        mock_extractor_cls.return_value.extract = MagicMock(return_value=mock_doc)

        async with client as c:
            # File text has no RG keywords, but documentTypes forces classification.
            response = await c.post(
                "/api/v1/documents/ocr",
                data={"documentTypes": "RG"},
                files=[("files", ("photo.png", sample_image_bytes, "image/png"))],
            )

    assert response.status_code == 200
    # Confirm that extract() was called with forced_type=DocumentType.RG
    mock_extractor_cls.return_value.extract.assert_called_once_with(
        "photo.png", "", forced_type=DocumentType.RG
    )


async def test_ocr_empty_string_document_type_returns_422(
    client: AsyncClient, sample_image_bytes: bytes
) -> None:
    """An empty string in documentTypes is rejected with 422 (no auto-detect)."""
    async with client as c:
        response = await c.post(
            "/api/v1/documents/ocr",
            data={"documentTypes": ""},
            files=[("files", ("photo.png", sample_image_bytes, "image/png"))],
        )

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert "Invalid document type" in body["error"]["message"]


async def test_ocr_multiple_files_explicit_document_types(
    client: AsyncClient, sample_image_bytes: bytes
) -> None:
    """documentTypes entries are index-matched to their corresponding files."""
    def make_doc(filename: str, doc_type: DocumentType) -> ExtractedDocument:
        return ExtractedDocument(
            filename=filename,
            document_type=doc_type,
            raw_text="",
            extracted_fields={},
        )

    with (
        patch("app.routers.documents.OcrService") as mock_ocr_cls,
        patch("app.routers.documents.ExtractorService") as mock_extractor_cls,
        patch("app.routers.documents.ExcelService") as mock_excel_cls,
    ):
        mock_ocr_cls.return_value.extract_text = AsyncMock(return_value="")
        mock_extractor_cls.return_value.extract = MagicMock(
            side_effect=[
                make_doc("first.png", DocumentType.RG),
                make_doc("second.png", DocumentType.BIRTH_CERTIFICATE),
            ]
        )
        mock_excel_cls.return_value.generate = MagicMock(return_value=b"fake-excel")

        async with client as c:
            response = await c.post(
                "/api/v1/documents/ocr",
                data={"documentTypes": ["RG", "BIRTH_CERTIFICATE"]},
                files=[
                    ("files", ("first.png", sample_image_bytes, "image/png")),
                    ("files", ("second.png", sample_image_bytes, "image/png")),
                ],
            )

    assert response.status_code == 200
    calls = mock_extractor_cls.return_value.extract.call_args_list
    assert len(calls) == 2
    assert calls[0].kwargs["forced_type"] == DocumentType.RG
    assert calls[1].kwargs["forced_type"] == DocumentType.BIRTH_CERTIFICATE


async def test_ocr_without_document_types_returns_422(
    client: AsyncClient, sample_image_bytes: bytes
) -> None:
    """When no documentTypes are provided, the request is rejected with 422."""
    async with client as c:
        response = await c.post(
            "/api/v1/documents/ocr",
            files=[("files", ("photo.png", sample_image_bytes, "image/png"))],
        )

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert "documentTypes" in body["error"]["message"]


async def test_ocr_content_type_header_determines_file_format(
    client: AsyncClient, sample_image_bytes: bytes
) -> None:
    """Content-Type header of the multipart part is used to resolve file extension."""
    mock_doc = ExtractedDocument(
        filename="document.bin",
        document_type=DocumentType.UNKNOWN,
        raw_text="",
        extracted_fields={},
    )

    with (
        patch("app.routers.documents.OcrService") as mock_ocr_cls,
        patch("app.routers.documents.ExtractorService") as mock_extractor_cls,
    ):
        mock_ocr_cls.return_value.extract_text = AsyncMock(return_value="")
        mock_extractor_cls.return_value.extract = MagicMock(return_value=mock_doc)

        async with client as c:
            # Filename has no recognisable extension, but the part Content-Type
            # identifies it as a PNG image — _resolve_extension picks .png.
            response = await c.post(
                "/api/v1/documents/ocr",
                data={"documentTypes": "RG"},
                files=[("files", ("document.bin", sample_image_bytes, "image/png"))],
            )

    assert response.status_code == 200
    mock_ocr_cls.return_value.extract_text.assert_awaited_once_with(
        sample_image_bytes, ".png"
    )

