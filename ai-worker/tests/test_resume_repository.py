"""Unit tests for the ResumeRepository data access layer."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from google.api_core.exceptions import GoogleAPIError

from app.models.resume import ResumeStatus, StructuredResumeFields
from app.repositories.resume_repository import ResumeNotFoundError, ResumeRepository


def _make_repo() -> tuple[ResumeRepository, MagicMock]:
    """Return a (ResumeRepository, mock_db) pair."""
    db = MagicMock()
    repo = ResumeRepository(db, collection_name="resumes")
    return repo, db


def _make_doc_snapshot(exists: bool, data: dict | None = None) -> MagicMock:  # type: ignore[type-arg]
    snapshot = MagicMock()
    snapshot.exists = exists
    snapshot.to_dict = MagicMock(return_value=data or {})
    return snapshot


class TestGetById:
    """Tests for ResumeRepository.get_by_id."""

    @pytest.mark.asyncio
    async def test_returns_resume_document_when_found(self) -> None:
        """get_by_id returns a populated ResumeDocument for an existing doc."""
        repo, db = _make_repo()
        snapshot = _make_doc_snapshot(
            exists=True,
            data={"status": "INGESTED", "rawText": "John Doe resume"},
        )
        doc_ref = MagicMock()
        doc_ref.get = AsyncMock(return_value=snapshot)
        db.collection.return_value.document.return_value = doc_ref

        result = await repo.get_by_id("resume-001")

        assert result.resume_id == "resume-001"
        assert result.status == ResumeStatus.INGESTED
        assert result.raw_text == "John Doe resume"

    @pytest.mark.asyncio
    async def test_raises_when_document_not_found(self) -> None:
        """get_by_id raises ResumeNotFoundError when snapshot.exists is False."""
        repo, db = _make_repo()
        snapshot = _make_doc_snapshot(exists=False)
        doc_ref = MagicMock()
        doc_ref.get = AsyncMock(return_value=snapshot)
        db.collection.return_value.document.return_value = doc_ref

        with pytest.raises(ResumeNotFoundError):
            await repo.get_by_id("missing-resume")

    @pytest.mark.asyncio
    async def test_raises_on_firestore_error(self) -> None:
        """get_by_id re-raises GoogleAPIError from Firestore."""
        repo, db = _make_repo()
        doc_ref = MagicMock()
        doc_ref.get = AsyncMock(side_effect=GoogleAPIError("connection error"))
        db.collection.return_value.document.return_value = doc_ref

        with pytest.raises(GoogleAPIError):
            await repo.get_by_id("resume-001")


class TestUpdateStatus:
    """Tests for ResumeRepository.update_status."""

    @pytest.mark.asyncio
    async def test_calls_firestore_update_with_correct_status(self) -> None:
        """update_status calls Firestore .update() with the correct payload."""
        repo, db = _make_repo()
        doc_ref = MagicMock()
        doc_ref.update = AsyncMock()
        db.collection.return_value.document.return_value = doc_ref

        await repo.update_status("resume-001", ResumeStatus.PROCESSING)

        doc_ref.update.assert_called_once()
        call_args = doc_ref.update.call_args[0][0]
        assert call_args["status"] == "PROCESSING"

    @pytest.mark.asyncio
    async def test_raises_on_firestore_error(self) -> None:
        """update_status re-raises GoogleAPIError from Firestore."""
        repo, db = _make_repo()
        doc_ref = MagicMock()
        doc_ref.update = AsyncMock(side_effect=GoogleAPIError("update failed"))
        db.collection.return_value.document.return_value = doc_ref

        with pytest.raises(GoogleAPIError):
            await repo.update_status("resume-001", ResumeStatus.PROCESSING)


class TestSaveProcessedData:
    """Tests for ResumeRepository.save_processed_data."""

    @pytest.mark.asyncio
    async def test_persists_structured_data_and_embedding(self) -> None:
        """save_processed_data writes the correct payload to Firestore."""
        repo, db = _make_repo()
        doc_ref = MagicMock()
        doc_ref.set = AsyncMock()
        db.collection.return_value.document.return_value = doc_ref

        structured = StructuredResumeFields(name="Jane", skills=["Python"])
        await repo.save_processed_data("resume-001", structured, [0.1, 0.2])

        doc_ref.set.assert_called_once()
        payload = doc_ref.set.call_args[0][0]
        assert payload["status"] == "PROCESSED"
        assert payload["embedding"] == [0.1, 0.2]
        assert payload["structuredData"]["name"] == "Jane"


class TestSaveProcessedDataError:
    """Tests for ResumeRepository.save_processed_data error path."""

    @pytest.mark.asyncio
    async def test_raises_on_firestore_error(self) -> None:
        """save_processed_data re-raises GoogleAPIError from Firestore."""
        repo, db = _make_repo()
        doc_ref = MagicMock()
        doc_ref.set = AsyncMock(side_effect=GoogleAPIError("set failed"))
        db.collection.return_value.document.return_value = doc_ref

        structured = StructuredResumeFields(name="Jane")
        with pytest.raises(GoogleAPIError):
            await repo.save_processed_data("resume-001", structured, [0.1])


class TestSaveErrorFirestoreError:
    """Tests for ResumeRepository.save_error error path."""

    @pytest.mark.asyncio
    async def test_raises_on_firestore_error(self) -> None:
        """save_error re-raises GoogleAPIError from Firestore."""
        repo, db = _make_repo()
        doc_ref = MagicMock()
        doc_ref.set = AsyncMock(side_effect=GoogleAPIError("set failed"))
        db.collection.return_value.document.return_value = doc_ref

        with pytest.raises(GoogleAPIError):
            await repo.save_error("resume-001", "Some error")
