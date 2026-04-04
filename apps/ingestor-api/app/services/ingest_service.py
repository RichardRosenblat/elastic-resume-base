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

import csv
import io
import os
import re
from datetime import UTC, datetime
from typing import Any

from hermes_py import IPublisher, get_publisher
from synapse_py.interfaces.resume_store import CreateResumeData, IResumeStore, UpdateResumeData
from toolbox_py import get_logger

from app.config import settings
from app.models.ingest import FileIngestRequest, IngestRequest, IngestResponse, IngestRowError
from app.services.text_extractor import SUPPORTED_EXTENSIONS, extract_text
from app.utils.exceptions import DriveDownloadError, SheetReadError, TextExtractionError

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Processing status constants (shared with AI Worker pipeline)
# ---------------------------------------------------------------------------

#: Resume has been ingested and raw text is stored; awaiting AI processing.
_STATUS_INGESTED = "INGESTED"
#: Resume ingestion failed; error details stored in ``metadata.ingestingInfo``.
_STATUS_FAILED = "FAILED"


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return (
        datetime.now(tz=UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


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

#: Accepted MIME types / extensions for uploaded spreadsheet files.
_EXCEL_EXTENSIONS = frozenset({".xlsx", ".xls", ".xlsm"})
_CSV_EXTENSIONS = frozenset({".csv"})
_UPLOAD_EXTENSIONS = _EXCEL_EXTENSIONS | _CSV_EXTENSIONS


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


def _read_links_from_excel(
    file_bytes: bytes,
    sheet_name: str | None,
    has_header_row: bool,
    link_column: str | None,
    link_column_index: int | None,
) -> list[tuple[int, str]]:
    """Parse an Excel workbook and return ``(row_number, url)`` pairs.

    Embedded cell hyperlinks (badge-style links) are preferred over plain cell
    text when present, enabling Drive links that are hidden behind user-friendly
    display text to be discovered automatically.

    Args:
        file_bytes: Raw bytes of the ``.xlsx`` / ``.xls`` / ``.xlsm`` file.
        sheet_name: Worksheet tab name.  Uses the active sheet when ``None``.
        has_header_row: Whether the first row contains column headers.
        link_column: Header label of the column containing Drive links.  Used
            when ``has_header_row`` is ``True``.
        link_column_index: 1-based column number.  Used when ``has_header_row``
            is ``False``.

    Returns:
        A list of ``(row_number, url)`` tuples for non-empty cells in the
        target column.  Row numbers are 1-based.

    Raises:
        ValueError: If the column cannot be located or required args are missing.
        Exception: If the file cannot be parsed.
    """
    import openpyxl  # type: ignore[import-untyped]

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb[sheet_name] if sheet_name else wb.active
    if ws is None:
        raise ValueError("Could not open the specified worksheet.")

    all_rows = list(ws.iter_rows())
    if not all_rows:
        return []

    def _cell_url(cell: Any) -> str:
        """Return the hyperlink target if present, else the cell value as str."""
        if cell.hyperlink and cell.hyperlink.target:
            return str(cell.hyperlink.target).strip()
        return str(cell.value or "").strip()

    if has_header_row:
        if link_column is None:
            raise ValueError(
                "'link_column' is required when 'has_header_row' is True for file uploads."
            )
        header_cells = all_rows[0]
        header_labels = [str(c.value or "").strip().lower() for c in header_cells]
        target = link_column.strip().lower()
        if target not in header_labels:
            raise ValueError(
                f"Column '{link_column}' not found in the uploaded file. "
                f"Available columns: {[str(c.value or '') for c in header_cells]}"
            )
        col_idx = header_labels.index(target)
        data_rows = all_rows[1:]
        start_row = 2
    else:
        if link_column_index is None:
            raise ValueError(
                "'link_column_index' is required when 'has_header_row' is False."
            )
        col_idx = link_column_index - 1
        data_rows = all_rows
        start_row = 1

    result: list[tuple[int, str]] = []
    for row_offset, row in enumerate(data_rows):
        row_number = start_row + row_offset
        if col_idx >= len(row):
            continue
        value = _cell_url(row[col_idx])
        if value:
            result.append((row_number, value))

    return result


def _read_links_from_csv(
    file_bytes: bytes,
    has_header_row: bool,
    link_column: str | None,
    link_column_index: int | None,
) -> list[tuple[int, str]]:
    """Parse a CSV file and return ``(row_number, url)`` pairs.

    Args:
        file_bytes: Raw bytes of the ``.csv`` file.
        has_header_row: Whether the first row contains column headers.
        link_column: Header label of the column containing Drive links.  Used
            when ``has_header_row`` is ``True``.
        link_column_index: 1-based column number.  Used when ``has_header_row``
            is ``False``.

    Returns:
        A list of ``(row_number, url)`` tuples for non-empty cells in the
        target column.  Row numbers are 1-based.

    Raises:
        ValueError: If the column cannot be located or required args are missing.
    """
    text = file_bytes.decode("utf-8-sig")  # handle BOM if present
    reader = csv.reader(io.StringIO(text))
    all_rows = list(reader)

    if not all_rows:
        return []

    if has_header_row:
        if link_column is None:
            raise ValueError(
                "'link_column' is required when 'has_header_row' is True for file uploads."
            )
        header_labels = [cell.strip().lower() for cell in all_rows[0]]
        target = link_column.strip().lower()
        if target not in header_labels:
            raise ValueError(
                f"Column '{link_column}' not found in the uploaded CSV file. "
                f"Available columns: {all_rows[0]}"
            )
        col_idx = header_labels.index(target)
        data_rows = all_rows[1:]
        start_row = 2
    else:
        if link_column_index is None:
            raise ValueError(
                "'link_column_index' is required when 'has_header_row' is False."
            )
        col_idx = link_column_index - 1
        data_rows = all_rows
        start_row = 1

    result: list[tuple[int, str]] = []
    for row_offset, row in enumerate(data_rows):
        row_number = start_row + row_offset
        if col_idx >= len(row):
            continue
        value = row[col_idx].strip()
        if value:
            result.append((row_number, value))

    return result


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

    def _persist_failed_record(
        self,
        row_number: int,
        drive_link: str,
        source_context: dict[str, Any],
        request_metadata: dict[str, Any],
        error: Exception,
    ) -> None:
        """Persist a ``FAILED`` stub record to Firestore for a row that could not be ingested.

        Creates a document with empty ``rawText`` and status ``FAILED`` so that
        every attempted ingestion — including rows that failed before text
        extraction — leaves an auditable Firestore record with error details.

        Failures to persist the stub are logged but do not propagate so that the
        main ingestion loop is never blocked.

        Args:
            row_number: The 1-based row number in the source spreadsheet.
            drive_link: The Google Drive link for the failed row.
            source_context: Provenance data (e.g. spreadsheetId or uploadedFile).
            request_metadata: Caller-supplied metadata attached to every resume.
            error: The exception that caused the row to fail.
        """
        try:
            source: dict[str, Any] = {
                **source_context,
                "driveLink": drive_link,
                "row": row_number,
            }
            failed_metadata: dict[str, Any] = {
                **request_metadata,
                "ingestingInfo": {
                    "failedAt": _now_iso(),
                    "errors": [
                        {
                            "errorType": type(error).__name__,
                            "errorMessage": str(error),
                        }
                    ],
                },
            }
            stub = self._resume_store.create_resume(
                CreateResumeData(raw_text="", source=source, metadata=failed_metadata)
            )
            self._resume_store.update_resume(
                stub.id,
                UpdateResumeData(status=_STATUS_FAILED),
            )
            logger.debug(
                "Persisted FAILED record to Firestore",
                extra={"resume_id": stub.id, "row": row_number},
            )
        except Exception as persist_exc:
            logger.warning(
                "Could not persist FAILED record to Firestore: %s",
                persist_exc,
                extra={"row": row_number},
            )

    async def ingest(self, request: IngestRequest) -> IngestResponse:
        """Execute the full resume ingestion pipeline for a Google Sheet.

        Steps:

        1. Resolve the spreadsheet ID from ``request.sheet_id`` or
           ``request.sheet_url``.
        2. Read the Drive-link column from the sheet using Bugle, extracting
           embedded hyperlinks (badges) in addition to plain text values.
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
            extra={
                "spreadsheet_id": spreadsheet_id,
                "link_column": link_column,
                "sheet_name": request.sheet_name,
                "has_header_row": request.has_header_row,
            },
        )

        # 1. Read the Google Sheet to get (row_number, drive_link) pairs.
        try:
            sheets = self._get_sheets_service()
            if request.has_header_row:
                row_links: list[tuple[int, str]] = sheets.get_column_values(
                    spreadsheet_id=spreadsheet_id,
                    column_header=link_column,
                    sheet_name=request.sheet_name,
                    extract_hyperlinks=True,
                )
            else:
                row_links = sheets.get_column_values(
                    spreadsheet_id=spreadsheet_id,
                    sheet_name=request.sheet_name,
                    column_index=request.link_column_index,
                    has_header_row=False,
                    extract_hyperlinks=True,
                )
        except Exception as exc:
            logger.error("Failed to read Google Sheet: %s", exc)
            raise SheetReadError(f"Failed to read Google Sheet: {exc}") from exc

        logger.info(
            "Found resume links in sheet",
            extra={"spreadsheet_id": spreadsheet_id, "link_count": len(row_links)},
        )

        return await self._ingest_links(
            row_links=row_links,
            source_context={"spreadsheetId": spreadsheet_id},
            request_metadata=request.metadata,
        )

    async def ingest_file(
        self,
        file_bytes: bytes,
        filename: str,
        request: FileIngestRequest,
    ) -> IngestResponse:
        """Execute the resume ingestion pipeline for an uploaded file.

        Supports ``.xlsx``, ``.xls``, ``.xlsm`` (Excel) and ``.csv`` files.
        Embedded cell hyperlinks in Excel files are extracted automatically,
        enabling badge-style Drive links to be discovered.

        Steps:

        1. Parse the uploaded file to extract ``(row_number, drive_link)`` pairs.
        2. For each row, download the resume from Drive and extract text.
        3. Persist the raw text to Firestore via Synapse.
        4. Publish ``{ resumeId }`` to the configured Pub/Sub topic.
        5. Collect per-row errors and publish them to the DLQ.

        Args:
            file_bytes: Raw bytes of the uploaded file.
            filename: Original filename (used to detect the file format).
            request: Validated parameters describing the file structure.

        Returns:
            :class:`~app.models.ingest.IngestResponse` with the count of
            successfully ingested resumes and any per-row errors.

        Raises:
            ValueError: If the file format is unsupported or the column cannot
                be located.
        """
        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        logger.info(
            "Starting file ingestion",
            extra={
                "upload_filename": filename,
                "extension": ext,
                "sheet_name": request.sheet_name,
                "has_header_row": request.has_header_row,
            },
        )

        if ext in _EXCEL_EXTENSIONS:
            effective_link_column = request.link_column or (
                settings.sheets_link_column if request.has_header_row else None
            )
            row_links = _read_links_from_excel(
                file_bytes=file_bytes,
                sheet_name=request.sheet_name,
                has_header_row=request.has_header_row,
                link_column=effective_link_column,
                link_column_index=request.link_column_index,
            )
        elif ext in _CSV_EXTENSIONS:
            effective_link_column = request.link_column or (
                settings.sheets_link_column if request.has_header_row else None
            )
            row_links = _read_links_from_csv(
                file_bytes=file_bytes,
                has_header_row=request.has_header_row,
                link_column=effective_link_column,
                link_column_index=request.link_column_index,
            )
        else:
            raise ValueError(
                f"Unsupported upload format '{ext}'. "
                f"Accepted extensions: {sorted(_UPLOAD_EXTENSIONS)}"
            )

        logger.info(
            "Parsed uploaded file",
            extra={"upload_filename": filename, "link_count": len(row_links)},
        )

        return await self._ingest_links(
            row_links=row_links,
            source_context={"uploadedFile": filename},
            request_metadata=request.metadata,
        )

    async def _ingest_links(
        self,
        row_links: list[tuple[int, str]],
        source_context: dict[str, Any],
        request_metadata: dict[str, Any],
    ) -> IngestResponse:
        """Process a list of ``(row_number, drive_link)`` pairs.

        Args:
            row_links: Pairs of 1-based row number and Google Drive link.
            source_context: Provenance data to attach to each Firestore document.
            request_metadata: Caller-supplied metadata to attach to each document.

        Returns:
            :class:`~app.models.ingest.IngestResponse` with counts and errors.
        """
        ingested_count = 0
        row_errors: list[IngestRowError] = []

        for row_number, drive_link in row_links:
            try:
                resume_id = await self._ingest_one(
                    row_number=row_number,
                    drive_link=drive_link,
                    source_context=source_context,
                    request_metadata=request_metadata,
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
                        **source_context,
                    },
                )
                self._persist_failed_record(
                    row_number=row_number,
                    drive_link=drive_link,
                    source_context=source_context,
                    request_metadata=request_metadata,
                    error=exc,
                )

        logger.info(
            "Ingestion complete",
            extra={
                **source_context,
                "ingested": ingested_count,
                "errors": len(row_errors),
            },
        )
        return IngestResponse(ingested=ingested_count, errors=row_errors)

    async def _ingest_one(
        self,
        row_number: int,
        drive_link: str,
        source_context: dict[str, Any],
        request_metadata: dict[str, Any],
    ) -> str:
        """Ingest a single resume from a Google Drive link.

        Args:
            row_number: The 1-based row number in the source spreadsheet.
            drive_link: Google Drive file URL or file ID.
            source_context: Provenance data (e.g. spreadsheetId or uploadedFile).
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
        drive = self._get_drive_service()
        try:
            content, mime_type = drive.download_file(file_id)
        except Exception as exc:
            raise DriveDownloadError(
                f"Failed to download Drive file '{file_id}': {exc}"
            ) from exc

        # 3. Resolve extension and extract text.
        # Attempt to get the filename from metadata to help with extension detection.
        try:
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

        # 4. Persist to Firestore via Synapse with INGESTED status.
        source: dict[str, Any] = {
            **source_context,
            "driveFileId": file_id,
            "driveLink": drive_link,
            "row": row_number,
        }
        ingesting_metadata: dict[str, Any] = {
            **request_metadata,
            "ingestingInfo": {
                "ingestedAt": _now_iso(),
                "errors": [],
            },
        }
        resume_doc = self._resume_store.create_resume(
            CreateResumeData(
                raw_text=raw_text,
                source=source,
                metadata=ingesting_metadata,
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
            # Update the Firestore document to FAILED so it doesn't appear INGESTED
            # without a corresponding downstream Pub/Sub event.
            try:
                self._resume_store.update_resume(
                    resume_id,
                    UpdateResumeData(
                        status=_STATUS_FAILED,
                        metadata={
                            **ingesting_metadata,
                            "ingestingInfo": {
                                "failedAt": _now_iso(),
                                "errors": [
                                    {
                                        "stage": "publish",
                                        "errorType": type(exc).__name__,
                                        "errorMessage": str(exc),
                                    }
                                ],
                            },
                        },
                    ),
                )
            except Exception as update_exc:
                logger.warning(
                    "Could not update resume status to FAILED after Pub/Sub failure: %s",
                    update_exc,
                    extra={"resume_id": resume_id},
                )
            # Re-raise so the row is counted as an error.
            raise

        return resume_id
