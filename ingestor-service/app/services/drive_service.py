"""Google Drive integration — downloads resume files and extracts their text."""

from __future__ import annotations

import io
import logging
from typing import Any

from googleapiclient.http import MediaIoBaseDownload
from pypdf import PdfReader

logger = logging.getLogger(__name__)

_MIME_PDF = "application/pdf"
_MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
_MIME_GOOGLE_DOC = "application/vnd.google-apps.document"
_MIME_PLAIN_TEXT = "text/plain"


class DriveService:
    """Downloads resume files from Google Drive and extracts their text content.

    Supports PDF, DOCX, Google Docs (exported as plain text), and plain-text
    files.  Unknown MIME types fall back to a raw UTF-8 decode attempt.

    Example:
        >>> from googleapiclient.discovery import build
        >>> drive = build("drive", "v3", credentials=creds)
        >>> svc = DriveService(drive_client=drive)
        >>> text = svc.download_and_extract(file_id="1BxiMVs0...")
    """

    def __init__(self, drive_client: Any) -> None:
        """Initialise the service.

        Args:
            drive_client: A ``googleapiclient.discovery.Resource`` object for
                the Drive API v3 (``build("drive", "v3", ...)``) or a mock.
        """
        self._client = drive_client

    def get_file_metadata(self, file_id: str) -> dict[str, str]:
        """Fetch file metadata (name, MIME type) for a Drive file.

        Args:
            file_id: The Google Drive file ID.

        Returns:
            A dict with at least ``"name"`` and ``"mimeType"`` keys.

        Raises:
            googleapiclient.errors.HttpError: If the Drive API returns an error.
        """
        metadata: dict[str, str] = (
            self._client.files()
            .get(fileId=file_id, fields="id,name,mimeType")
            .execute()
        )
        return metadata

    def download_and_extract(self, file_id: str) -> str:
        """Download a file from Google Drive and return its text content.

        For Google Docs the file is exported as plain text.  For PDFs the text
        layer is extracted using ``pypdf``.  DOCX files are read via the
        ``python-docx`` library if available, or fall back to raw bytes.

        Args:
            file_id: The Google Drive file ID.

        Returns:
            Extracted plain-text content.

        Raises:
            googleapiclient.errors.HttpError: If the Drive API returns an error.
            ValueError: If the file type cannot be handled.
        """
        metadata = self.get_file_metadata(file_id)
        mime_type = metadata.get("mimeType", "")
        file_name = metadata.get("name", file_id)

        logger.debug(
            "Downloading Drive file '%s' (id=%s, mime=%s).",
            file_name,
            file_id,
            mime_type,
        )

        if mime_type == _MIME_GOOGLE_DOC:
            return self._export_google_doc(file_id, file_name)
        elif mime_type == _MIME_PDF:
            return self._download_and_extract_pdf(file_id, file_name)
        elif mime_type == _MIME_DOCX:
            return self._download_and_extract_docx(file_id, file_name)
        elif mime_type == _MIME_PLAIN_TEXT:
            return self._download_raw_text(file_id, file_name)
        else:
            logger.warning(
                "Unknown MIME type '%s' for file '%s' — attempting raw text extraction.",
                mime_type,
                file_name,
            )
            return self._download_raw_text(file_id, file_name)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _export_google_doc(self, file_id: str, file_name: str) -> str:
        """Export a Google Doc as plain text."""
        request = self._client.files().export_media(
            fileId=file_id, mimeType=_MIME_PLAIN_TEXT
        )
        content: bytes = request.execute()
        text = content.decode("utf-8", errors="replace")
        logger.debug("Exported Google Doc '%s' (%d chars).", file_name, len(text))
        return text

    def _download_raw_bytes(self, file_id: str) -> bytes:
        """Download raw file bytes from Drive."""
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(
            buf, self._client.files().get_media(fileId=file_id)
        )
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buf.getvalue()

    def _download_and_extract_pdf(self, file_id: str, file_name: str) -> str:
        """Download a PDF and extract its text layer using pypdf."""
        raw = self._download_raw_bytes(file_id)
        reader = PdfReader(io.BytesIO(raw))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
        logger.debug("Extracted PDF '%s' (%d pages, %d chars).", file_name, len(pages), len(text))
        return text

    def _download_and_extract_docx(self, file_id: str, file_name: str) -> str:
        """Download a DOCX file and extract its text."""
        try:
            import docx

            raw = self._download_raw_bytes(file_id)
            doc = docx.Document(io.BytesIO(raw))
            text = "\n".join(para.text for para in doc.paragraphs)
            logger.debug("Extracted DOCX '%s' (%d chars).", file_name, len(text))
            return text
        except ImportError:
            logger.warning(
                "python-docx not installed; falling back to raw text for '%s'.", file_name
            )
            return self._download_raw_text(file_id, file_name)

    def _download_raw_text(self, file_id: str, file_name: str) -> str:
        """Download file bytes and decode as UTF-8 text."""
        raw = self._download_raw_bytes(file_id)
        text = raw.decode("utf-8", errors="replace")
        logger.debug("Downloaded raw text '%s' (%d chars).", file_name, len(text))
        return text
