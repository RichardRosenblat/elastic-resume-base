"""Unit tests for the IngestService orchestration logic."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from hermes.interfaces.event_publisher import PublishPayload

from app.services.ingest_service import IngestService
from tests.conftest import MockEventPublisher


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service(
    sheets_rows: list[dict[str, str]],
    extracted_text: str = "Resume content",
    resume_id: str = "resume-abc",
    publisher: MockEventPublisher | None = None,
    dlq_topic: str = "dead-letter-queue",
    ingestor_topic: str = "resume-ingested",
) -> tuple[IngestService, MockEventPublisher]:
    """Build an IngestService with fully mocked dependencies."""
    if publisher is None:
        publisher = MockEventPublisher()

    mock_sheets = MagicMock()
    mock_sheets.get_resume_rows.return_value = sheets_rows

    mock_drive = MagicMock()
    mock_drive.download_and_extract.return_value = extracted_text

    mock_store = MagicMock()
    mock_store.create.return_value = resume_id

    service = IngestService(
        sheets=mock_sheets,
        drive=mock_drive,
        store=mock_store,
        publisher=publisher,
        ingestor_topic=ingestor_topic,
        dlq_topic=dlq_topic,
    )
    return service, publisher


# ---------------------------------------------------------------------------
# ingest_from_sheet
# ---------------------------------------------------------------------------


class TestIngestFromSheet:
    """Tests for IngestService.ingest_from_sheet."""

    def test_returns_resume_ids_for_valid_rows(self) -> None:
        """Returns a list of ingested resume IDs."""
        rows = [{"fileId": "file-1"}, {"fileId": "file-2"}]
        service, _ = _make_service(sheets_rows=rows, resume_id="r-1")
        # Drive returns the same text twice; store returns the same ID twice
        result = service.ingest_from_sheet(sheet_id="sheet-abc")
        assert len(result) == 2

    def test_returns_empty_list_when_no_rows(self) -> None:
        """Returns an empty list when the sheet has no data rows."""
        service, _ = _make_service(sheets_rows=[])
        result = service.ingest_from_sheet(sheet_id="sheet-empty")
        assert result == []

    def test_skips_rows_without_file_id(self) -> None:
        """Rows without a fileId column are skipped."""
        rows = [{"candidateName": "Alice"}, {"fileId": "file-1"}]
        service, _ = _make_service(sheets_rows=rows)
        result = service.ingest_from_sheet(sheet_id="sheet-abc")
        assert len(result) == 1

    def test_publishes_resume_ingested_event(self) -> None:
        """A resume-ingested event is published for each successful ingest."""
        rows = [{"fileId": "file-1"}]
        service, publisher = _make_service(sheets_rows=rows, resume_id="resume-xyz")
        service.ingest_from_sheet(sheet_id="sheet-abc")

        assert len(publisher.published) == 1
        topic, payload = publisher.published[0]
        assert topic == "resume-ingested"
        assert payload.data == {"resumeId": "resume-xyz"}

    def test_publishes_to_dlq_on_drive_error(self) -> None:
        """A DLQ event is published when Drive download fails."""
        publisher = MockEventPublisher()
        mock_sheets = MagicMock()
        mock_sheets.get_resume_rows.return_value = [{"fileId": "bad-file"}]
        mock_drive = MagicMock()
        mock_drive.download_and_extract.side_effect = RuntimeError("Drive error")
        mock_store = MagicMock()

        service = IngestService(
            sheets=mock_sheets,
            drive=mock_drive,
            store=mock_store,
            publisher=publisher,
            ingestor_topic="resume-ingested",
            dlq_topic="dead-letter-queue",
        )
        result = service.ingest_from_sheet(sheet_id="sheet-abc")

        assert result == []
        assert len(publisher.published) == 1
        dlq_topic, dlq_payload = publisher.published[0]
        assert dlq_topic == "dead-letter-queue"
        assert dlq_payload.data["fileId"] == "bad-file"
        assert dlq_payload.data["service"] == "ingestor-service"

    def test_continues_after_single_row_failure(self) -> None:
        """Processing continues for remaining rows when one row fails."""
        publisher = MockEventPublisher()
        call_count = 0

        def extract_side_effect(file_id: str) -> str:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("First file failed")
            return "Resume text"

        mock_sheets = MagicMock()
        mock_sheets.get_resume_rows.return_value = [
            {"fileId": "file-bad"},
            {"fileId": "file-good"},
        ]
        mock_drive = MagicMock()
        mock_drive.download_and_extract.side_effect = extract_side_effect
        mock_store = MagicMock()
        mock_store.create.return_value = "resume-good"

        service = IngestService(
            sheets=mock_sheets,
            drive=mock_drive,
            store=mock_store,
            publisher=publisher,
            ingestor_topic="resume-ingested",
            dlq_topic="dead-letter-queue",
        )
        result = service.ingest_from_sheet(sheet_id="sheet-abc")

        # Only the successful row is in the result
        assert result == ["resume-good"]
        # One DLQ + one ingested event
        topics = [t for t, _ in publisher.published]
        assert "dead-letter-queue" in topics
        assert "resume-ingested" in topics

    def test_metadata_merged_into_store_call(self) -> None:
        """Extra metadata from ingest_from_sheet is merged into the store.create call."""
        rows = [{"fileId": "file-1", "candidateName": "Alice"}]
        mock_sheets = MagicMock()
        mock_sheets.get_resume_rows.return_value = rows
        mock_drive = MagicMock()
        mock_drive.download_and_extract.return_value = "text"
        mock_store = MagicMock()
        mock_store.create.return_value = "r-1"
        publisher = MockEventPublisher()

        service = IngestService(
            sheets=mock_sheets,
            drive=mock_drive,
            store=mock_store,
            publisher=publisher,
            ingestor_topic="resume-ingested",
            dlq_topic="dead-letter-queue",
        )
        service.ingest_from_sheet(sheet_id="s", metadata={"campaign": "spring-2026"})

        call_kwargs = mock_store.create.call_args
        stored_meta: dict[str, Any] = call_kwargs[1]["metadata"]
        assert stored_meta["campaign"] == "spring-2026"
        assert stored_meta["candidateName"] == "Alice"

    def test_dlq_publish_failure_does_not_raise(self) -> None:
        """A DLQ publish failure is silently swallowed."""
        broken_publisher = MagicMock()
        broken_publisher.publish.side_effect = RuntimeError("Pub/Sub unavailable")

        mock_sheets = MagicMock()
        mock_sheets.get_resume_rows.return_value = [{"fileId": "bad-file"}]
        mock_drive = MagicMock()
        mock_drive.download_and_extract.side_effect = RuntimeError("Drive error")
        mock_store = MagicMock()

        service = IngestService(
            sheets=mock_sheets,
            drive=mock_drive,
            store=mock_store,
            publisher=broken_publisher,
            ingestor_topic="resume-ingested",
            dlq_topic="dead-letter-queue",
        )
        # Should not raise even though both drive and DLQ fail
        result = service.ingest_from_sheet(sheet_id="s")
        assert result == []


# ---------------------------------------------------------------------------
# ingest_one
# ---------------------------------------------------------------------------


class TestIngestOne:
    """Tests for IngestService.ingest_one."""

    def test_returns_resume_id_on_success(self) -> None:
        """Returns the Firestore resume ID when ingest succeeds."""
        service, _ = _make_service(sheets_rows=[], resume_id="r-xyz")
        result = service.ingest_one(file_id="file-123")
        assert result == "r-xyz"

    def test_returns_none_on_failure(self) -> None:
        """Returns None when the ingest pipeline fails."""
        publisher = MockEventPublisher()
        mock_sheets = MagicMock()
        mock_drive = MagicMock()
        mock_drive.download_and_extract.side_effect = RuntimeError("Error")
        mock_store = MagicMock()

        service = IngestService(
            sheets=mock_sheets,
            drive=mock_drive,
            store=mock_store,
            publisher=publisher,
            ingestor_topic="resume-ingested",
            dlq_topic="dead-letter-queue",
        )
        result = service.ingest_one(file_id="bad-file")
        assert result is None

    def test_publishes_ingested_event_on_success(self) -> None:
        """A resume-ingested event is published with the correct resumeId."""
        service, publisher = _make_service(sheets_rows=[], resume_id="r-123")
        service.ingest_one(file_id="file-1")

        assert len(publisher.published) == 1
        topic, payload = publisher.published[0]
        assert topic == "resume-ingested"
        assert payload.data["resumeId"] == "r-123"

    def test_publishes_dlq_event_on_failure(self) -> None:
        """A DLQ event is published with error details when ingest fails."""
        publisher = MockEventPublisher()
        mock_sheets = MagicMock()
        mock_drive = MagicMock()
        mock_drive.download_and_extract.side_effect = ValueError("Bad file format")
        mock_store = MagicMock()

        service = IngestService(
            sheets=mock_sheets,
            drive=mock_drive,
            store=mock_store,
            publisher=publisher,
            ingestor_topic="resume-ingested",
            dlq_topic="dead-letter-queue",
        )
        service.ingest_one(file_id="bad-file")

        assert len(publisher.published) == 1
        topic, payload = publisher.published[0]
        assert topic == "dead-letter-queue"
        assert payload.data["fileId"] == "bad-file"
        assert payload.data["errorType"] == "ValueError"
