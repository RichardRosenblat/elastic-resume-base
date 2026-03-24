"""Core ingest orchestration service.

Coordinates the full resume ingestion pipeline:
1. Read resume rows from a Google Sheet.
2. For each row, download the file from Google Drive and extract text.
3. Persist the raw text (+ metadata) in Firestore via Synapse.
4. Publish a ``resume-ingested`` event to Cloud Pub/Sub via Hermes.
5. On any unrecoverable error, publish a DLQ event via Hermes.

The ``max_ai_calls_per_batch`` setting caps the number of resumes processed
per job so that unexpected batch sizes cannot cause runaway Vertex AI costs.
"""

from __future__ import annotations

import logging
from typing import Any

from hermes.interfaces.event_publisher import IEventPublisher, PublishPayload

from app.services.drive_service import DriveService
from app.services.resume_store import IResumeStore
from app.services.sheets_service import SheetsService

logger = logging.getLogger(__name__)

# Column name in the Google Sheet that holds the Drive file ID.
_FILE_ID_COL = "fileId"


class IngestService:
    """Orchestrates the full resume ingestion pipeline.

    All dependencies are injected at construction time so that the service can
    be unit-tested without any real GCP calls.

    Example:
        >>> service = IngestService(
        ...     sheets=SheetsService(sheets_client=mock_sheets),
        ...     drive=DriveService(drive_client=mock_drive),
        ...     store=mock_resume_store,
        ...     publisher=mock_publisher,
        ...     ingestor_topic="resume-ingested",
        ...     dlq_topic="dead-letter-queue",
        ...     max_ai_calls_per_batch=50,
        ... )
        >>> resume_ids = service.ingest_from_sheet(sheet_id="1BxiMVs0...", metadata={})
    """

    def __init__(
        self,
        sheets: SheetsService,
        drive: DriveService,
        store: IResumeStore,
        publisher: IEventPublisher,
        ingestor_topic: str,
        dlq_topic: str,
        max_ai_calls_per_batch: int = 50,
    ) -> None:
        self._sheets = sheets
        self._drive = drive
        self._store = store
        self._publisher = publisher
        self._ingestor_topic = ingestor_topic
        self._dlq_topic = dlq_topic
        self._max_ai_calls_per_batch = max_ai_calls_per_batch

    def ingest_from_sheet(
        self,
        sheet_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> list[str]:
        """Ingest all resumes listed in a Google Sheet.

        Iterates over every data row in the sheet.  For each row that contains
        a ``fileId`` column, the corresponding Drive file is downloaded and
        ingested.  Rows without a ``fileId`` are skipped with a warning.

        If ``max_ai_calls_per_batch`` is set (> 0), only the first
        ``max_ai_calls_per_batch`` rows with a ``fileId`` are processed; the
        rest are skipped with a warning.

        If a single row fails, the error is published to the DLQ and processing
        continues with the next row so that one bad file does not block the
        entire batch.

        Args:
            sheet_id: The Google Sheets file ID.
            metadata: Optional metadata dict to attach to every created resume
                document (e.g. campaign name, owner email).

        Returns:
            A list of Firestore resume IDs that were successfully ingested.

        Raises:
            Exception: Only if reading the sheet itself fails (row-level
                failures are swallowed and forwarded to the DLQ).
        """
        logger.info("Starting sheet ingest for sheet_id='%s'.", sheet_id)
        rows = self._sheets.get_resume_rows(sheet_id)

        if not rows:
            logger.warning("No rows found in sheet '%s'.", sheet_id)
            return []

        # Filter rows that have a fileId before applying the AI call cap.
        eligible = [r for r in rows if r.get(_FILE_ID_COL, "").strip()]
        skipped_no_file_id = len(rows) - len(eligible)
        if skipped_no_file_id:
            logger.warning(
                "Skipping %d row(s) without fileId in sheet '%s'.",
                skipped_no_file_id,
                sheet_id,
            )

        # Apply the AI call budget cap.
        if self._max_ai_calls_per_batch > 0 and len(eligible) > self._max_ai_calls_per_batch:
            logger.warning(
                "Batch size %d exceeds max_ai_calls_per_batch=%d; "
                "truncating to %d rows for sheet '%s'.",
                len(eligible),
                self._max_ai_calls_per_batch,
                self._max_ai_calls_per_batch,
                sheet_id,
            )
            eligible = eligible[: self._max_ai_calls_per_batch]

        ingested_ids: list[str] = []
        for row in eligible:
            file_id = row[_FILE_ID_COL].strip()
            resume_id = self._ingest_one(
                file_id=file_id,
                row_metadata={**row, **(metadata or {})},
            )
            if resume_id:
                ingested_ids.append(resume_id)

        logger.info(
            "Sheet ingest complete: %d/%d rows ingested (cap=%s).",
            len(ingested_ids),
            len(eligible),
            self._max_ai_calls_per_batch or "unlimited",
        )
        return ingested_ids

    def ingest_one(
        self,
        file_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> str | None:
        """Ingest a single resume file identified by its Drive file ID.

        Args:
            file_id: Google Drive file ID.
            metadata: Optional metadata to attach to the Firestore document.

        Returns:
            The Firestore resume ID on success, or ``None`` on failure
            (the error is published to the DLQ).
        """
        return self._ingest_one(file_id=file_id, row_metadata=metadata or {})

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _ingest_one(self, file_id: str, row_metadata: dict[str, Any]) -> str | None:
        """Download, store, and publish a single resume file.

        Errors are caught, logged, and forwarded to the DLQ topic so that
        the caller's batch loop can continue.

        Args:
            file_id: Google Drive file ID.
            row_metadata: Metadata from the source sheet row.

        Returns:
            The Firestore resume ID on success, or ``None`` on failure.
        """
        try:
            text = self._drive.download_and_extract(file_id)
            resume_id = self._store.create(text=text, metadata=row_metadata)
            self._publisher.publish(
                self._ingestor_topic,
                PublishPayload(
                    data={"resumeId": resume_id},
                    attributes={"source": "ingestor-service"},
                ),
            )
            logger.info("Ingested resume id=%s from file_id=%s.", resume_id, file_id)
            return resume_id
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Failed to ingest file_id=%s: %s",
                file_id,
                exc,
                exc_info=True,
            )
            self._publish_dlq_error(file_id=file_id, error=exc)
            return None

    def _publish_dlq_error(self, file_id: str, error: Exception) -> None:
        """Publish an error event to the DLQ topic.

        Failures during DLQ publishing are logged but not re-raised to avoid
        masking the original error.

        Args:
            file_id: The Drive file ID that caused the failure.
            error: The exception that was raised.
        """
        try:
            self._publisher.publish(
                self._dlq_topic,
                PublishPayload(
                    data={
                        "service": "ingestor-service",
                        "fileId": file_id,
                        "error": str(error),
                        "errorType": type(error).__name__,
                    },
                    attributes={"source": "ingestor-service", "eventType": "ingest-error"},
                ),
            )
        except Exception as dlq_exc:  # noqa: BLE001
            logger.error(
                "Failed to publish DLQ message for file_id=%s: %s",
                file_id,
                dlq_exc,
                exc_info=True,
            )
