"""Unit tests for FirestoreResumeStore."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

import pytest

from synapse.repositories.firestore_resume_store import FirestoreResumeStore


def _make_store(doc_id: str = "resume-001") -> tuple[FirestoreResumeStore, MagicMock]:
    """Build a FirestoreResumeStore with a mock Firestore client."""
    db = MagicMock()
    doc_ref = MagicMock()
    doc_ref.id = doc_id
    db.collection.return_value.document.return_value = doc_ref
    return FirestoreResumeStore(db=db, collection="resumes"), db


class TestFirestoreResumeStoreCreate:
    """Tests for FirestoreResumeStore.create."""

    def test_returns_document_id(self) -> None:
        """Returns the Firestore document ID."""
        store, _ = _make_store(doc_id="resume-xyz")
        result = store.create(text="Hello world")
        assert result == "resume-xyz"

    def test_writes_text_to_firestore(self) -> None:
        """The text is written to the Firestore document."""
        store, db = _make_store()
        store.create(text="Resume content")
        doc = db.collection.return_value.document.return_value.set.call_args[0][0]
        assert doc["text"] == "Resume content"

    def test_writes_ingested_status(self) -> None:
        """The document status is set to INGESTED."""
        store, db = _make_store()
        store.create(text="text")
        doc = db.collection.return_value.document.return_value.set.call_args[0][0]
        assert doc["status"] == "INGESTED"

    def test_writes_metadata(self) -> None:
        """Metadata is written to the document."""
        store, db = _make_store()
        store.create(text="text", metadata={"source": "sheet-abc", "name": "Alice"})
        doc = db.collection.return_value.document.return_value.set.call_args[0][0]
        assert doc["metadata"]["source"] == "sheet-abc"
        assert doc["metadata"]["name"] == "Alice"

    def test_writes_empty_metadata_when_not_provided(self) -> None:
        """Metadata defaults to an empty dict when not supplied."""
        store, db = _make_store()
        store.create(text="text")
        doc = db.collection.return_value.document.return_value.set.call_args[0][0]
        assert doc["metadata"] == {}

    def test_writes_created_at_timestamp(self) -> None:
        """A createdAt ISO-8601 timestamp is included in the document."""
        store, db = _make_store()
        store.create(text="text")
        doc = db.collection.return_value.document.return_value.set.call_args[0][0]
        dt = datetime.fromisoformat(doc["createdAt"])
        assert dt is not None

    def test_uses_configured_collection(self) -> None:
        """The configured collection name is used for the Firestore write."""
        db = MagicMock()
        doc_ref = MagicMock()
        doc_ref.id = "r-1"
        db.collection.return_value.document.return_value = doc_ref
        store = FirestoreResumeStore(db=db, collection="custom-resumes")
        store.create(text="text")
        db.collection.assert_called_with("custom-resumes")

    def test_document_set_is_called_once(self) -> None:
        """doc_ref.set() is called exactly once per create()."""
        store, db = _make_store()
        store.create(text="text")
        doc_ref = db.collection.return_value.document.return_value
        doc_ref.set.assert_called_once()
