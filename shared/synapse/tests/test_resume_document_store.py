"""Unit tests for FirestoreResumeDocumentStore."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from google.api_core.exceptions import GoogleAPIError

from synapse.errors import NotFoundError
from synapse.repositories.firestore_resume_document_store import FirestoreResumeDocumentStore


def _make_store() -> tuple[FirestoreResumeDocumentStore, MagicMock]:
    mock_db = MagicMock()
    with patch("synapse.repositories.firestore_resume_document_store.get_db", return_value=mock_db):
        store = FirestoreResumeDocumentStore()
    return store, mock_db


class TestGetById:
    """Tests for FirestoreResumeDocumentStore.get_by_id()."""

    @pytest.mark.asyncio
    async def test_returns_document_when_found(self) -> None:
        store, db = _make_store()
        snapshot = MagicMock()
        snapshot.exists = True
        snapshot.to_dict.return_value = {
            "status": "INGESTED",
            "rawText": "Jane Doe resume",
        }
        doc_ref = MagicMock()
        doc_ref.get = AsyncMock(return_value=snapshot)
        with patch(
            "synapse.repositories.firestore_resume_document_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            result = await store.get_by_id("resume-001")

        assert result.resume_id == "resume-001"
        assert result.raw_text == "Jane Doe resume"
        assert result.status == "INGESTED"

    @pytest.mark.asyncio
    async def test_raises_not_found_when_missing(self) -> None:
        store, _ = _make_store()
        snapshot = MagicMock()
        snapshot.exists = False
        doc_ref = MagicMock()
        doc_ref.get = AsyncMock(return_value=snapshot)
        with patch(
            "synapse.repositories.firestore_resume_document_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            with pytest.raises(NotFoundError):
                await store.get_by_id("missing")

    @pytest.mark.asyncio
    async def test_raises_on_firestore_error(self) -> None:
        store, _ = _make_store()
        doc_ref = MagicMock()
        doc_ref.get = AsyncMock(side_effect=GoogleAPIError("network error"))
        with patch(
            "synapse.repositories.firestore_resume_document_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            with pytest.raises(GoogleAPIError):
                await store.get_by_id("resume-001")


class TestUpdateStatus:
    """Tests for FirestoreResumeDocumentStore.update_status()."""

    @pytest.mark.asyncio
    async def test_calls_update_with_status(self) -> None:
        store, _ = _make_store()
        doc_ref = MagicMock()
        doc_ref.update = AsyncMock()
        with patch(
            "synapse.repositories.firestore_resume_document_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            await store.update_status("resume-001", "PROCESSING")

        doc_ref.update.assert_called_once()
        assert doc_ref.update.call_args[0][0]["status"] == "PROCESSING"

    @pytest.mark.asyncio
    async def test_raises_on_firestore_error(self) -> None:
        store, _ = _make_store()
        doc_ref = MagicMock()
        doc_ref.update = AsyncMock(side_effect=GoogleAPIError("err"))
        with patch(
            "synapse.repositories.firestore_resume_document_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            with pytest.raises(GoogleAPIError):
                await store.update_status("resume-001", "PROCESSING")


class TestSaveStructuredData:
    """Tests for FirestoreResumeDocumentStore.save_structured_data()."""

    @pytest.mark.asyncio
    async def test_writes_structured_data_with_merge(self) -> None:
        store, _ = _make_store()
        doc_ref = MagicMock()
        doc_ref.set = AsyncMock()
        with patch(
            "synapse.repositories.firestore_resume_document_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            await store.save_structured_data("resume-001", {"name": "Jane"})

        doc_ref.set.assert_called_once()
        payload = doc_ref.set.call_args[0][0]
        assert payload["structuredData"]["name"] == "Jane"

    @pytest.mark.asyncio
    async def test_raises_on_firestore_error(self) -> None:
        store, _ = _make_store()
        doc_ref = MagicMock()
        doc_ref.set = AsyncMock(side_effect=GoogleAPIError("err"))
        with patch(
            "synapse.repositories.firestore_resume_document_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            with pytest.raises(GoogleAPIError):
                await store.save_structured_data("resume-001", {})


class TestSaveError:
    """Tests for FirestoreResumeDocumentStore.save_error()."""

    @pytest.mark.asyncio
    async def test_writes_failed_status_and_error_message(self) -> None:
        store, _ = _make_store()
        doc_ref = MagicMock()
        doc_ref.set = AsyncMock()
        with patch(
            "synapse.repositories.firestore_resume_document_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            await store.save_error("resume-001", "Vertex AI timed out")

        payload = doc_ref.set.call_args[0][0]
        assert payload["status"] == "FAILED"
        assert payload["error"] == "Vertex AI timed out"

    @pytest.mark.asyncio
    async def test_raises_on_firestore_error(self) -> None:
        store, _ = _make_store()
        doc_ref = MagicMock()
        doc_ref.set = AsyncMock(side_effect=GoogleAPIError("err"))
        with patch(
            "synapse.repositories.firestore_resume_document_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            with pytest.raises(GoogleAPIError):
                await store.save_error("resume-001", "oops")
