"""Unit tests for FirestoreResumeEmbeddingStore."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from google.api_core.exceptions import GoogleAPIError

from synapse.repositories.firestore_resume_embedding_store import FirestoreResumeEmbeddingStore


class TestSaveEmbedding:
    """Tests for FirestoreResumeEmbeddingStore.save_embedding()."""

    @pytest.mark.asyncio
    async def test_writes_resume_id_and_embedding(self) -> None:
        store = FirestoreResumeEmbeddingStore()
        doc_ref = MagicMock()
        doc_ref.set = AsyncMock()
        with patch(
            "synapse.repositories.firestore_resume_embedding_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            await store.save_embedding("resume-001", [0.1, 0.2, 0.3])

        doc_ref.set.assert_called_once()
        payload = doc_ref.set.call_args[0][0]
        assert payload["resumeId"] == "resume-001"
        assert payload["embedding"] == [0.1, 0.2, 0.3]

    @pytest.mark.asyncio
    async def test_raises_on_firestore_error(self) -> None:
        store = FirestoreResumeEmbeddingStore()
        doc_ref = MagicMock()
        doc_ref.set = AsyncMock(side_effect=GoogleAPIError("err"))
        with patch(
            "synapse.repositories.firestore_resume_embedding_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            with pytest.raises(GoogleAPIError):
                await store.save_embedding("resume-001", [0.1])


class TestGetByResumeId:
    """Tests for FirestoreResumeEmbeddingStore.get_by_resume_id()."""

    @pytest.mark.asyncio
    async def test_returns_entry_when_found(self) -> None:
        store = FirestoreResumeEmbeddingStore()
        snapshot = MagicMock()
        snapshot.exists = True
        snapshot.to_dict.return_value = {
            "resumeId": "resume-001",
            "embedding": [0.5, 0.6],
        }
        doc_ref = MagicMock()
        doc_ref.get = AsyncMock(return_value=snapshot)
        with patch(
            "synapse.repositories.firestore_resume_embedding_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            result = await store.get_by_resume_id("resume-001")

        assert result is not None
        assert result.resume_id == "resume-001"
        assert result.embedding == [0.5, 0.6]

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self) -> None:
        store = FirestoreResumeEmbeddingStore()
        snapshot = MagicMock()
        snapshot.exists = False
        doc_ref = MagicMock()
        doc_ref.get = AsyncMock(return_value=snapshot)
        with patch(
            "synapse.repositories.firestore_resume_embedding_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            result = await store.get_by_resume_id("missing")

        assert result is None

    @pytest.mark.asyncio
    async def test_raises_on_firestore_error(self) -> None:
        store = FirestoreResumeEmbeddingStore()
        doc_ref = MagicMock()
        doc_ref.get = AsyncMock(side_effect=GoogleAPIError("err"))
        with patch(
            "synapse.repositories.firestore_resume_embedding_store.get_db"
        ) as mock_get_db:
            mock_get_db.return_value.collection.return_value.document.return_value = doc_ref
            with pytest.raises(GoogleAPIError):
                await store.get_by_resume_id("resume-001")
