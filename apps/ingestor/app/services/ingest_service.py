"""Core business logic for the ingestor service.

Orchestrates the full resume ingestion pipeline:

1. Parse the Google Sheets URL / ID to obtain the spreadsheet ID.
2. Read the spreadsheet via Bugle's :class:`~bugle_py.SheetsService` to get
   the list of Google Drive links (and their row numbers).
3. For each link, download the resume file from Google Drive using
   :class:`~bugle_py.DriveService`.
4. Extract plain text from the file using :func:`~app.services.text_extractor.extract_text`.
5. Persist the raw text to Firestore via Synapse's
   :class:`~synapse_py.FirestoreResumeStore`.
6. Publish a ``{ resumeId }`` message to the configured Pub/Sub topic via
   :func:`~hermes_py.get_publisher`.
7. Collect any per-row errors and publish them to the DLQ topic.
"""

from __future__ import annotations

import os
import re
from typing import Any

from hermes_py import IPublisher, get_publisher
from synapse_py.interfaces.resume_store import CreateResumeData, IResumeStore
from toolbox_py import get_logger

from app.config import settings
from app.models.ingest import IngestRequest, IngestResponse, IngestRowError
from app.services.text_extractor import SUPPORTED_EXTENSIONS, extract_text
from app.utils.exceptions import DriveDownloadError, SheetReadError, TextExtractionError

logger = get_logger(__name__)

#: Regex to extract a Google Sheets spreadsheet ID from a Sheets URL.
_SHEETS_ID_PATTERN = re.compile(
    r"https://docs\.google\.com/spreadsheets/d/([A-Za-z0-9_\-]{25,})"
)

#: Map of MIME types returned by Drive to file extensions.
_MIME_TO_EXT: dict[str, str] = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.google-apps.document": ".docx",  # exported as DOCX
    "application/msword": ".docx",
}


def _extract_sheet_id(sheet_id: str | None, sheet_url: str | None) -> str:
    """Resolve the spreadsheet ID from the provided ``sheet_id`` or ``sheet_url``.

    Args:
        sheet_id: A bare Google Sheets file ID.
        sheet_url: A full Google Sheets URL from which the ID is extracted.

    Returns:
        The resolved spreadsheet ID.

    Raises:
        ValueError: If neither ``sheet_id`` nor ``sheet_url`` is given, or if
            the URL cannot be parsed.
    """
    if sheet_id:
        return sheet_id.strip()
    if sheet_url:
        match = _SHEETS_ID_PATTERN.search(sheet_url.strip())
        if match:
            return match.group(1)
        # Fall back: treat the URL as a bare ID if it looks like one.
        raw = sheet_url.strip()
        if re.fullmatch(r"[A-Za-z0-9_\-]{25,}", raw):
            return raw
        raise ValueError(
            f"Could not extract a Google Sheets ID from URL: {sheet_url!r}. "
            "Expected a URL in the format "
            "'https://docs.google.com/spreadsheets/d/<ID>/...'."
        )
    raise ValueError("Either 'sheet_id' or 'sheet_url' must be provided.")


def _resolve_extension(mime_type: str, filename: str) -> str:
    """Determine the file extension from a MIME type or filename.

    Args:
        mime_type: MIME type returned by the Drive API.
        filename: Original filename (used as fallback).

    Returns:
        Lowercase file extension including the leading dot (e.g. ``".pdf"``).
    """
    ext = _MIME_TO_EXT.get(mime_type.lower(), "")
    if ext:
        return ext
    _, file_ext = os.path.splitext(filename)
    return file_ext.lower()


class IngestService:
    """Orchestrates the resume ingestion pipeline.

    This service is the single integration point between Bugle (Google Sheets /
    Drive), Synapse (Firestore), and Hermes (Pub/Sub).

    Example::

        from synapse_py import FirestoreResumeStore
        from app.services.ingest_service import IngestService
        from app.models.ingest import IngestRequest

        service = IngestService(resume_store=FirestoreResumeStore())
        response = await service.ingest(
            IngestRequest(sheet_id="1BxiMVs0XRA5...", link_column="resume_link")
        )
    """

    def __init__(
        self,
        resume_store: IResumeStore,
        publisher: IPublisher | None = None,
        sheets_service: object | None = None,
        drive_service: object | None = None,
    ) -> None:
        """Initialise the ingest service with its dependencies.

        Args:
            resume_store: Synapse resume store for Firestore persistence.
            publisher: Optional Hermes publisher.  Defaults to the global
                singleton returned by :func:`~hermes_py.get_publisher`.
            sheets_service: Optional Bugle :class:`~bugle_py.SheetsService`
                instance.  Defaults to a new instance constructed at call time.
            drive_service: Optional Bugle :class:`~bugle_py.DriveService`
                instance.  Defaults to a new instance constructed at call time.
        """
        self._resume_store = resume_store
        self._publisher = publisher
        self._sheets_service = sheets_service
        self._drive_service = drive_service

    def _get_publisher(self) -> IPublisher:
        """Return the Hermes publisher singleton.

        Returns:
            The active :class:`~hermes_py.interfaces.publisher.IPublisher` instance.
        """
        return self._publisher or get_publisher()

    def _get_sheets_service(self) -> Any:
        """Return a :class:`~bugle_py.SheetsService` instance.

        Returns:
            A configured SheetsService.
        """
        if self._sheets_service is not None:
            return self._sheets_service
        from bugle_py import SheetsService

        return SheetsService()

    def _get_drive_service(self) -> Any:
        """Return a :class:`~bugle_py.DriveService` instance.

        Returns:
            A configured DriveService.
        """
        if self._drive_service is not None:
            return self._drive_service
        from bugle_py import DriveService

        return DriveService()

    def _publish_dlq_error(self, error: str, context: dict[str, Any]) -> None:
        """Publish an error message to the dead-letter queue topic.

        Failures to publish to the DLQ are logged but do not raise — the main
        ingestion flow must not be blocked by DLQ publishing errors.

        Args:
            error: Human-readable error description.
            context: Contextual data to include in the DLQ message.
        """
        try:
            publisher = self._get_publisher()
            publisher.publish(
                settings.pubsub_topic_dlq,
                {"error": error, "service": "ingestor", **context},
            )
            logger.debug("Published DLQ message", extra={"error": error})
        except Exception as exc:
            logger.warning("Failed to publish DLQ message: %s", exc)

    async def ingest(self, request: IngestRequest) -> IngestResponse:
        """Execute the full resume ingestion pipeline for a Google Sheet.

        Steps:

        1. Resolve the spreadsheet ID from ``request.sheet_id`` or
           ``request.sheet_url``.
        2. Read the Drive-link column from the sheet using Bugle.
        3. For each row, download the resume from Drive and extract text.
        4. Persist the raw text to Firestore via Synapse.
        5. Publish ``{ resumeId }`` to the configured Pub/Sub topic.
        6. Collect per-row errors and publish them to the DLQ.

        Args:
            request: The validated ingest request.

        Returns:
            :class:`~app.models.ingest.IngestResponse` with the count of
            successfully ingested resumes and any per-row errors.

        Raises:
            SheetReadError: If the spreadsheet cannot be read.
        """
        spreadsheet_id = _extract_sheet_id(request.sheet_id, request.sheet_url)
        link_column = request.link_column or settings.sheets_link_column

        logger.info(
            "Starting ingestion",
            extra={"spreadsheet_id": spreadsheet_id, "link_column": link_column},
        )

        # 1. Read the Google Sheet to get (row_number, drive_link) pairs.
        try:
            sheets = self._get_sheets_service()
            row_links: list[tuple[int, str]] = sheets.get_column_values(
                spreadsheet_id=spreadsheet_id,
                column_header=link_column,
            )
        except Exception as exc:
            logger.error("Failed to read Google Sheet: %s", exc)
            raise SheetReadError(f"Failed to read Google Sheet: {exc}") from exc

        logger.info(
            "Found resume links in sheet",
            extra={"spreadsheet_id": spreadsheet_id, "link_count": len(row_links)},
        )

        ingested_count = 0
        row_errors: list[IngestRowError] = []

        for row_number, drive_link in row_links:
            try:
                resume_id = await self._ingest_one(
                    row_number=row_number,
                    drive_link=drive_link,
                    spreadsheet_id=spreadsheet_id,
                    request_metadata=request.metadata,
                )
                ingested_count += 1
                logger.info(
                    "Resume ingested",
                    extra={"row": row_number, "resume_id": resume_id},
                )
            except Exception as exc:
                error_msg = str(exc)
                logger.warning(
                    "Failed to ingest resume at row %d: %s",
                    row_number,
                    error_msg,
                )
                row_errors.append(IngestRowError(row=row_number, error=error_msg))
                self._publish_dlq_error(
                    error_msg,
                    context={
                        "row": row_number,
                        "driveLink": drive_link,
                        "spreadsheetId": spreadsheet_id,
                    },
                )

        logger.info(
            "Ingestion complete",
            extra={
                "spreadsheet_id": spreadsheet_id,
                "ingested": ingested_count,
                "errors": len(row_errors),
            },
        )
        return IngestResponse(ingested=ingested_count, errors=row_errors)

    async def _ingest_one(
        self,
        row_number: int,
        drive_link: str,
        spreadsheet_id: str,
        request_metadata: dict[str, Any],
    ) -> str:
        """Ingest a single resume from a Google Drive link.

        Args:
            row_number: The 1-based row number in the source spreadsheet.
            drive_link: Google Drive file URL or file ID.
            spreadsheet_id: The source spreadsheet ID (stored as provenance).
            request_metadata: Caller-supplied metadata to attach to the document.

        Returns:
            The Firestore document ID (``resumeId``) for the ingested resume.

        Raises:
            DriveDownloadError: If downloading the file from Drive fails.
            TextExtractionError: If text extraction fails.
            Exception: If the Firestore write or Pub/Sub publish fails.
        """
        from bugle_py.services.sheets_service import extract_drive_id

        file_id = extract_drive_id(drive_link)
        if not file_id:
            raise DriveDownloadError(
                f"Could not extract a Google Drive file ID from: {drive_link!r}"
            )

        # 2. Download the file from Google Drive.
        try:
            drive = self._get_drive_service()
            content, mime_type = drive.download_file(file_id)
        except Exception as exc:
            raise DriveDownloadError(
                f"Failed to download Drive file '{file_id}': {exc}"
            ) from exc

        # 3. Resolve extension and extract text.
        # Attempt to get the filename from metadata to help with extension detection.
        try:
            drive = self._get_drive_service()
            metadata = drive.get_file_metadata(file_id)
            filename: str = metadata.get("name", "")
        except Exception:
            filename = ""

        extension = _resolve_extension(mime_type, filename)
        if extension not in SUPPORTED_EXTENSIONS:
            raise TextExtractionError(
                f"Unsupported file type '{extension}' for Drive file '{file_id}'. "
                f"Supported types: {sorted(SUPPORTED_EXTENSIONS)}"
            )

        raw_text = extract_text(content, extension)

        # 4. Persist to Firestore via Synapse.
        source: dict[str, Any] = {
            "spreadsheetId": spreadsheet_id,
            "driveFileId": file_id,
            "driveLink": drive_link,
            "row": row_number,
        }
        resume_doc = self._resume_store.create_resume(
            CreateResumeData(
                raw_text=raw_text,
                source=source,
                metadata=request_metadata,
            )
        )
        resume_id = resume_doc.id

        # 5. Publish to Pub/Sub.
        try:
            publisher = self._get_publisher()
            publisher.publish(
                settings.pubsub_topic_resume_ingested,
                {"resumeId": resume_id},
            )
        except Exception as exc:
            logger.warning(
                "Failed to publish resume-ingested Pub/Sub message: %s", exc,
                extra={"resume_id": resume_id},
            )
            # Re-raise so the row is counted as an error.
            raise

        return resume_id
