"""Unit tests for the DriveService."""

from __future__ import annotations

import io
import sys
from unittest.mock import MagicMock, patch

import pytest

from app.services.drive_service import (
    DriveService,
    _MIME_DOCX,
    _MIME_GOOGLE_DOC,
    _MIME_PDF,
    _MIME_PLAIN_TEXT,
)


def _make_drive_client(
    mime_type: str = _MIME_PLAIN_TEXT,
    file_name: str = "resume.txt",
) -> MagicMock:
    """Build a mock Drive API client that returns the given MIME type."""
    client = MagicMock()
    client.files().get().execute.return_value = {
        "id": "file-abc",
        "name": file_name,
        "mimeType": mime_type,
    }
    return client


def _make_service(
    mime_type: str = _MIME_PLAIN_TEXT,
    file_name: str = "resume.txt",
) -> tuple[DriveService, MagicMock]:
    client = _make_drive_client(mime_type=mime_type, file_name=file_name)
    return DriveService(drive_client=client), client


class TestDriveServiceGetFileMetadata:
    """Tests for DriveService.get_file_metadata."""

    def test_returns_metadata_dict(self) -> None:
        """Returns a dict with name and mimeType."""
        svc, client = _make_service()
        result = svc.get_file_metadata("file-abc")
        assert result["name"] == "resume.txt"
        assert result["mimeType"] == _MIME_PLAIN_TEXT

    def test_passes_file_id_to_api(self) -> None:
        """The file_id is forwarded to the Drive API."""
        svc, client = _make_service()
        svc.get_file_metadata("my-file-id")
        client.files().get.assert_called_with(
            fileId="my-file-id", fields="id,name,mimeType"
        )


class TestDriveServiceDownloadAndExtract:
    """Tests for DriveService.download_and_extract."""

    def test_plain_text_file_decoded(self) -> None:
        """Plain text files are downloaded and decoded as UTF-8."""
        svc, client = _make_service(mime_type=_MIME_PLAIN_TEXT, file_name="cv.txt")
        raw_bytes = b"Plain text resume content"

        with patch.object(svc, "_download_raw_bytes", return_value=raw_bytes):
            result = svc.download_and_extract("file-abc")

        assert result == "Plain text resume content"

    def test_unknown_mime_type_falls_back_to_raw_text(self) -> None:
        """Unknown MIME types fall back to raw UTF-8 text extraction."""
        svc, client = _make_service(mime_type="application/unknown", file_name="cv.bin")
        raw_bytes = b"Unknown format content"

        with patch.object(svc, "_download_raw_bytes", return_value=raw_bytes):
            result = svc.download_and_extract("file-abc")

        assert result == "Unknown format content"

    def test_google_doc_uses_export(self) -> None:
        """Google Docs are exported as plain text via the export_media API."""
        svc, client = _make_service(mime_type=_MIME_GOOGLE_DOC, file_name="doc.gdoc")
        exported_bytes = b"Exported plain text"
        client.files().export_media().execute.return_value = exported_bytes

        result = svc.download_and_extract("file-abc")

        assert result == "Exported plain text"
        client.files().export_media.assert_called_with(
            fileId="file-abc", mimeType=_MIME_PLAIN_TEXT
        )

    def test_pdf_text_extracted(self) -> None:
        """PDF files have their text layer extracted via pypdf."""
        svc, client = _make_service(mime_type=_MIME_PDF, file_name="resume.pdf")

        mock_page = MagicMock()
        mock_page.extract_text.return_value = "PDF page text"
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]

        with (
            patch.object(svc, "_download_raw_bytes", return_value=b"%PDF-fake"),
            patch("app.services.drive_service.PdfReader", return_value=mock_reader),
        ):
            result = svc.download_and_extract("file-abc")

        assert result == "PDF page text"

    def test_pdf_page_none_replaced_with_empty_string(self) -> None:
        """PDF pages that return None from extract_text are replaced with empty string."""
        svc, client = _make_service(mime_type=_MIME_PDF, file_name="resume.pdf")

        mock_page = MagicMock()
        mock_page.extract_text.return_value = None
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]

        with (
            patch.object(svc, "_download_raw_bytes", return_value=b"%PDF-fake"),
            patch("app.services.drive_service.PdfReader", return_value=mock_reader),
        ):
            result = svc.download_and_extract("file-abc")

        assert result == ""

    def test_docx_text_extracted(self) -> None:
        """DOCX files have their text extracted paragraph by paragraph."""
        svc, client = _make_service(mime_type=_MIME_DOCX, file_name="resume.docx")

        mock_para1 = MagicMock()
        mock_para1.text = "First paragraph"
        mock_para2 = MagicMock()
        mock_para2.text = "Second paragraph"
        mock_doc = MagicMock()
        mock_doc.paragraphs = [mock_para1, mock_para2]
        mock_docx_module = MagicMock()
        mock_docx_module.Document.return_value = mock_doc

        with (
            patch.object(svc, "_download_raw_bytes", return_value=b"PK docx bytes"),
            patch.dict("sys.modules", {"docx": mock_docx_module}),
        ):
            result = svc.download_and_extract("file-abc")

        assert result == "First paragraph\nSecond paragraph"

    def test_docx_falls_back_to_raw_when_python_docx_missing(self) -> None:
        """Falls back to raw text extraction when python-docx is not installed."""
        svc, client = _make_service(mime_type=_MIME_DOCX, file_name="resume.docx")
        raw_bytes = b"raw docx bytes"

        original = sys.modules.get("docx")
        sys.modules["docx"] = None  # type: ignore[assignment]
        try:
            with patch.object(svc, "_download_raw_bytes", return_value=raw_bytes):
                result = svc.download_and_extract("file-abc")
        finally:
            if original is None:
                sys.modules.pop("docx", None)
            else:
                sys.modules["docx"] = original

        assert result == "raw docx bytes"


class TestDriveServiceDownloadRawBytes:
    """Tests for DriveService._download_raw_bytes."""

    def test_returns_accumulated_bytes(self) -> None:
        """_download_raw_bytes returns the full file content."""
        svc, client = _make_service()
        expected = b"file content bytes"

        call_count = 0

        def fake_next_chunk() -> tuple[None, bool]:
            nonlocal call_count
            call_count += 1
            return None, call_count >= 2

        mock_downloader = MagicMock()
        mock_downloader.next_chunk.side_effect = fake_next_chunk

        def fake_downloader_cls(buf: io.BytesIO, _req: object) -> MagicMock:
            buf.write(expected)
            return mock_downloader

        with patch("app.services.drive_service.MediaIoBaseDownload", side_effect=fake_downloader_cls):
            result = svc._download_raw_bytes("file-abc")

        assert result == expected
