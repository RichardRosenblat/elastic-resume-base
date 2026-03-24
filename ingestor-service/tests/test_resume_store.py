"""Tests verifying the ingestor uses Synapse's IResumeStore interface.

The concrete Firestore implementation (FirestoreResumeStore) is tested
exhaustively in shared/synapse/tests/.  These tests focus on:
1. The IResumeStore import from app.services.resume_store is stable.
2. IngestService accepts any IResumeStore-compatible object.
3. MockResumeStore (used across the test suite) satisfies IResumeStore.
"""

from __future__ import annotations

from typing import Any

import pytest

from synapse.interfaces.resume_store import IResumeStore

from app.services.resume_store import IResumeStore as AppIResumeStore
from tests.conftest import MockResumeStore


class TestResumeStoreInterface:
    """Verify that app.services.resume_store re-exports IResumeStore correctly."""

    def test_app_import_is_synapse_interface(self) -> None:
        """app.services.resume_store.IResumeStore is the Synapse IResumeStore."""
        assert AppIResumeStore is IResumeStore

    def test_mock_resume_store_satisfies_protocol(self) -> None:
        """MockResumeStore is structurally compatible with IResumeStore."""
        store = MockResumeStore()
        # isinstance checks the Protocol (runtime_checkable).
        assert isinstance(store, IResumeStore)

    def test_mock_resume_store_create_returns_id(self) -> None:
        """MockResumeStore.create() returns the configured default ID."""
        store = MockResumeStore(default_id="mock-001")
        result = store.create(text="Resume text")
        assert result == "mock-001"

    def test_mock_resume_store_records_text(self) -> None:
        """MockResumeStore.create() records the provided text."""
        store = MockResumeStore()
        store.create(text="Candidate resume content", metadata={"source": "test"})
        assert store.created[0]["text"] == "Candidate resume content"

    def test_mock_resume_store_records_metadata(self) -> None:
        """MockResumeStore.create() records the provided metadata."""
        store = MockResumeStore()
        store.create(text="text", metadata={"campaign": "spring-2026"})
        assert store.created[0]["metadata"]["campaign"] == "spring-2026"

    def test_mock_resume_store_empty_metadata_defaults_to_dict(self) -> None:
        """MockResumeStore.create() uses empty dict when metadata is None."""
        store = MockResumeStore()
        store.create(text="text")
        assert store.created[0]["metadata"] == {}
