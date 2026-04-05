"""Unit tests for TranslationCacheStore."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, call, patch

import pytest

from app.services.translation_cache_store import (
    MAX_CACHE_SIZE,
    TranslationCacheStore,
    _BATCH_SIZE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_store(
    collection_name: str = "translation-cache",
    max_size: int = MAX_CACHE_SIZE,
) -> TranslationCacheStore:
    return TranslationCacheStore(collection_name=collection_name, max_size=max_size)


def _make_mock_db() -> tuple[MagicMock, MagicMock]:
    """Return (mock_db, mock_collection)."""
    mock_col = MagicMock()
    mock_db = MagicMock()
    mock_db.collection.return_value = mock_col
    return mock_db, mock_col


def _make_doc(doc_id: str, usage: int = 5) -> MagicMock:
    """Return a mock Firestore DocumentSnapshot."""
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = True
    doc.to_dict.return_value = {
        "sourceText": f"text-{doc_id}",
        "translatedText": f"translated-{doc_id}",
        "targetLanguage": "pt",
        "usage": usage,
    }
    return doc


# ---------------------------------------------------------------------------
# get() — cache miss
# ---------------------------------------------------------------------------


def test_get_returns_none_on_miss() -> None:
    """get() returns None when the document does not exist."""
    store = _make_store()
    mock_db, mock_col = _make_mock_db()
    missing_doc = MagicMock()
    missing_doc.exists = False
    mock_col.document.return_value.get.return_value = missing_doc

    with patch.object(store, "_db", return_value=mock_db):
        result = store.get("nonexistent-key")

    assert result is None


def test_get_returns_none_on_firestore_error() -> None:
    """get() returns None without raising when Firestore is unavailable."""
    store = _make_store()
    mock_db = MagicMock()
    mock_db.collection.side_effect = Exception("Firestore unavailable")

    with patch.object(store, "_db", return_value=mock_db):
        result = store.get("some-key")

    assert result is None


# ---------------------------------------------------------------------------
# get() — cache hit + decay
# ---------------------------------------------------------------------------


def test_get_returns_cached_text_on_hit() -> None:
    """get() returns the translated text on a cache hit."""
    store = _make_store()
    mock_db, mock_col = _make_mock_db()
    hit_doc = _make_doc("key-1", usage=3)
    mock_col.document.return_value.get.return_value = hit_doc
    mock_col.stream.return_value = []  # no other entries for decay

    with patch.object(store, "_db", return_value=mock_db):
        result = store.get("key-1")

    assert result == "translated-key-1"


def test_get_calls_apply_decay_on_hit() -> None:
    """get() calls _apply_decay after a cache hit."""
    store = _make_store()
    mock_db, mock_col = _make_mock_db()
    hit_doc = _make_doc("key-1")
    mock_col.document.return_value.get.return_value = hit_doc

    with patch.object(store, "_db", return_value=mock_db):
        with patch.object(store, "_apply_decay") as mock_decay:
            store.get("key-1")

    mock_decay.assert_called_once_with(touched_key="key-1", delta=1)


# ---------------------------------------------------------------------------
# set() — new entry + decay + prune
# ---------------------------------------------------------------------------


def test_set_stores_new_entry_with_usage_one() -> None:
    """set() stores the new entry with usage=1."""
    store = _make_store()
    mock_db, mock_col = _make_mock_db()
    mock_col.stream.return_value = []

    with (
        patch.object(store, "_db", return_value=mock_db),
        patch.object(store, "_apply_decay"),
        patch.object(store, "_prune_if_needed"),
    ):
        store.set("k1", "Hello", "Olá", "pt")

    mock_col.document.return_value.set.assert_called_once()
    payload = mock_col.document.return_value.set.call_args.args[0]
    assert payload["sourceText"] == "Hello"
    assert payload["translatedText"] == "Olá"
    assert payload["targetLanguage"] == "pt"
    assert payload["usage"] == 1


def test_set_calls_apply_decay() -> None:
    """set() calls _apply_decay after storing the new entry."""
    store = _make_store()
    mock_db, mock_col = _make_mock_db()

    with (
        patch.object(store, "_db", return_value=mock_db),
        patch.object(store, "_apply_decay") as mock_decay,
        patch.object(store, "_prune_if_needed"),
    ):
        store.set("k2", "Hello", "Bonjour", "fr")

    mock_decay.assert_called_once_with(touched_key="k2", delta=1)


def test_set_calls_prune_after_store() -> None:
    """set() calls _prune_if_needed after applying decay."""
    store = _make_store()
    mock_db, mock_col = _make_mock_db()

    with (
        patch.object(store, "_db", return_value=mock_db),
        patch.object(store, "_apply_decay"),
        patch.object(store, "_prune_if_needed") as mock_prune,
    ):
        store.set("k3", "World", "Mundo", "es")

    mock_prune.assert_called_once()


def test_set_swallows_errors() -> None:
    """set() does not raise when Firestore is unavailable."""
    store = _make_store()
    mock_db = MagicMock()
    mock_db.collection.side_effect = Exception("Firestore down")

    with patch.object(store, "_db", return_value=mock_db):
        store.set("k4", "text", "texte", "fr")  # should not raise


# ---------------------------------------------------------------------------
# _apply_decay — increments touched, decrements others
# ---------------------------------------------------------------------------


def test_apply_decay_increments_touched_entry() -> None:
    """_apply_decay increments the usage of the touched entry."""
    store = _make_store()
    mock_db, mock_col = _make_mock_db()
    mock_col.select.return_value.stream.return_value = []  # no other entries

    from firebase_admin import firestore as fs  # type: ignore[import-untyped]

    with patch("firebase_admin.firestore.client", return_value=mock_db):
        store._apply_decay(touched_key="key-x", delta=1)

    mock_col.document.return_value.update.assert_called_once()
    update_args = mock_col.document.return_value.update.call_args.args[0]
    assert "usage" in update_args


def test_apply_decay_decrements_other_entries_in_batch() -> None:
    """_apply_decay decrements all other entries via batch write."""
    store = _make_store()
    mock_db, mock_col = _make_mock_db()

    # 3 other documents returned by the projected query
    other_docs = [_make_doc(f"other-{i}") for i in range(3)]
    # _apply_decay uses collection.select([]).stream()
    mock_col.select.return_value.stream.return_value = [_make_doc("touched")] + other_docs

    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch

    with patch("firebase_admin.firestore.client", return_value=mock_db):
        store._apply_decay(touched_key="touched", delta=1)

    # batch.commit() should have been called once (all others fit in one batch)
    mock_batch.commit.assert_called_once()
    # batch.update() called once per other doc
    assert mock_batch.update.call_count == 3


def test_apply_decay_uses_multiple_batches_for_large_collections() -> None:
    """_apply_decay splits large collections into multiple batch commits."""
    store = _make_store()
    mock_db, mock_col = _make_mock_db()

    # Create _BATCH_SIZE + 10 other documents
    n_others = _BATCH_SIZE + 10
    other_docs = [_make_doc(f"other-{i}") for i in range(n_others)]
    mock_col.select.return_value.stream.return_value = other_docs  # touched key not in stream

    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch

    with patch("firebase_admin.firestore.client", return_value=mock_db):
        store._apply_decay(touched_key="not-in-stream", delta=1)

    # Should have 2 batch commits: one for 500 docs, one for 10 docs
    assert mock_batch.commit.call_count == 2


def test_apply_decay_swallows_errors() -> None:
    """_apply_decay does not raise when Firestore is unavailable."""
    store = _make_store()
    mock_db = MagicMock()
    mock_db.collection.side_effect = Exception("Firestore down")

    with patch("firebase_admin.firestore.client", return_value=mock_db):
        store._apply_decay(touched_key="k", delta=1)  # should not raise


# ---------------------------------------------------------------------------
# _prune_if_needed — evicts lowest-usage entries when over limit
# ---------------------------------------------------------------------------


def test_prune_does_nothing_when_under_limit() -> None:
    """_prune_if_needed does not delete anything when count <= max_size."""
    store = _make_store(max_size=10)
    mock_db, mock_col = _make_mock_db()

    # Simulate count aggregation returning 5
    mock_count_result = MagicMock()
    mock_count_result.__getitem__ = lambda self, i: (
        [MagicMock(value=5)] if i == 0 else []
    )
    mock_col.count.return_value.get.return_value = mock_count_result

    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch

    with patch("firebase_admin.firestore.client", return_value=mock_db):
        store._prune_if_needed()

    mock_batch.delete.assert_not_called()


def test_prune_deletes_lowest_usage_entries_when_over_limit() -> None:
    """_prune_if_needed deletes the lowest-usage entries when over the limit."""
    store = _make_store(max_size=3)
    mock_db, mock_col = _make_mock_db()

    # 5 entries with different usage; max_size=3 so 2 should be deleted
    docs = [
        _make_doc("doc-a", usage=10),
        _make_doc("doc-b", usage=1),   # lowest -- should be deleted
        _make_doc("doc-c", usage=5),
        _make_doc("doc-d", usage=0),   # lowest -- should be deleted
        _make_doc("doc-e", usage=8),
    ]

    # Simulate count() aggregation returning 5 (> max_size 3)
    mock_count_result = MagicMock()
    mock_count_result.__getitem__ = lambda self, i: (
        [MagicMock(value=5)] if i == 0 else []
    )
    mock_col.count.return_value.get.return_value = mock_count_result

    # stream() for the full document scan (used only when pruning is needed)
    mock_col.stream.return_value = docs

    mock_batch = MagicMock()
    mock_db.batch.return_value = mock_batch

    # Track which document IDs are passed to batch.delete
    deleted_doc_ids: list[str] = []

    def capture_delete(doc_ref: Any) -> None:
        deleted_doc_ids.append(doc_ref.id)

    mock_batch.delete.side_effect = capture_delete

    # Make collection.document(id) return a ref whose .id equals the argument
    def make_doc_ref(doc_id: str) -> MagicMock:
        ref = MagicMock()
        ref.id = doc_id
        return ref

    mock_col.document.side_effect = make_doc_ref

    with patch("firebase_admin.firestore.client", return_value=mock_db):
        store._prune_if_needed()

    # Should delete 2 entries (doc-d usage=0 and doc-b usage=1)
    assert mock_batch.delete.call_count == 2
    mock_batch.commit.assert_called_once()
    assert set(deleted_doc_ids) == {"doc-b", "doc-d"}


def test_prune_swallows_errors() -> None:
    """_prune_if_needed does not raise when Firestore is unavailable."""
    store = _make_store()
    mock_db = MagicMock()
    mock_db.collection.side_effect = Exception("Firestore down")

    with patch("firebase_admin.firestore.client", return_value=mock_db):
        store._prune_if_needed()  # should not raise
