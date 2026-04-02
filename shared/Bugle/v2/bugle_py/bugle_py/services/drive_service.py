"""Google Drive service for downloading files and querying permissions."""

from __future__ import annotations

import io
import logging
from typing import Any

from bugle_py.auth import DRIVE_READONLY_SCOPES, get_google_auth_client

logger = logging.getLogger(__name__)


class DriveService:
    """Service for downloading files from Google Drive.

    Uses the **Google Drive API v3** to retrieve file content and metadata.

    Authentication uses **Application Default Credentials (ADC)** by default.
    Pass explicit *credentials* to override ADC (e.g. in tests).

    Example::

        from bugle_py import DriveService

        service = DriveService()
        content, mime_type = service.download_file(file_id="1BxiMVs0XRA5nFMd...")
    """

    def __init__(
        self,
        credentials: object | None = None,
    ) -> None:
        """Initialise the Drive service.

        Args:
            credentials: Optional pre-configured credentials object.  Defaults
                to ADC via :func:`~bugle_py.auth.get_google_auth_client`.
        """
        try:
            from googleapiclient.discovery import build  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "The 'google-api-python-client' package is required for DriveService. "
                "Install it with: pip install google-api-python-client"
            ) from exc

        resolved_credentials = credentials or get_google_auth_client(DRIVE_READONLY_SCOPES)
        self._service = build("drive", "v3", credentials=resolved_credentials)
        logger.debug("DriveService initialised")

    def get_file_metadata(self, file_id: str) -> dict[str, Any]:
        """Retrieve metadata for a Google Drive file.

        Args:
            file_id: The Google Drive file ID.

        Returns:
            A dictionary containing file metadata fields including ``name``,
            ``mimeType``, and ``size``.

        Raises:
            Exception: If the Drive API call fails or the file is not found.
        """
        logger.debug("Fetching file metadata", extra={"file_id": file_id})
        metadata: dict[str, Any] = (
            self._service.files()
            .get(fileId=file_id, fields="id,name,mimeType,size", supportsAllDrives=True)
            .execute()
        )
        logger.debug(
            "File metadata retrieved",
            extra={"file_id": file_id, "name": metadata.get("name"), "mime": metadata.get("mimeType")},
        )
        return metadata

    def download_file(self, file_id: str) -> tuple[bytes, str]:
        """Download the binary content of a Google Drive file.

        For Google Docs, Sheets, and Slides (native Google formats) the file
        is exported to a standard format automatically:

        - Google Docs → DOCX (``application/vnd.openxmlformats-officedocument.wordprocessingml.document``)
        - Google Sheets → XLSX (``application/vnd.openxmlformats-officedocument.spreadsheetml.sheet``)

        All other files are downloaded directly.

        Args:
            file_id: The Google Drive file ID.

        Returns:
            A tuple of ``(content_bytes, mime_type)`` where ``mime_type`` is the
            effective MIME type after any export conversion.

        Raises:
            Exception: If the Drive API call fails or the file cannot be downloaded.
        """
        try:
            from googleapiclient.http import MediaIoBaseDownload  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "The 'google-api-python-client' package is required for DriveService. "
                "Install it with: pip install google-api-python-client"
            ) from exc

        logger.debug("Downloading Drive file", extra={"file_id": file_id})
        metadata = self.get_file_metadata(file_id)
        mime_type: str = metadata.get("mimeType", "application/octet-stream")

        # Map Google native formats to their export targets.
        _EXPORT_MAP: dict[str, str] = {
            "application/vnd.google-apps.document": (
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
            "application/vnd.google-apps.spreadsheet": (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
            "application/vnd.google-apps.presentation": (
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            ),
        }

        buffer = io.BytesIO()

        if mime_type in _EXPORT_MAP:
            export_mime = _EXPORT_MAP[mime_type]
            logger.debug(
                "Exporting Google native file",
                extra={"file_id": file_id, "export_mime": export_mime},
            )
            request = self._service.files().export_media(
                fileId=file_id, mimeType=export_mime
            )
            mime_type = export_mime
        else:
            request = self._service.files().get_media(
                fileId=file_id, supportsAllDrives=True
            )

        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        content = buffer.getvalue()
        logger.debug(
            "Drive file downloaded",
            extra={"file_id": file_id, "size_bytes": len(content), "mime_type": mime_type},
        )
        return content, mime_type
