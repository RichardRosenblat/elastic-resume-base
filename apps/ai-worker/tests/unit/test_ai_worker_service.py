"""Unit tests for AIWorkerService."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, call, patch

import pytest

from app.services.ai_worker_service import (
    AIWorkerService,
    STATUS_FAILED,
    STATUS_PROCESSED,
    STATUS_PROCESSING,
    _skills_text,
)
from app.utils.exceptions import EmbeddingError, ExtractionError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service(
    store: Any = None,
    vertex_ai: Any = None,
    publisher: Any = None,
) -> AIWorkerService:
    """Build an AIWorkerService with sensible mock defaults."""
    return AIWorkerService(
        resume_store=store or MagicMock(),
        vertex_ai_service=vertex_ai or MagicMock(),
        publisher=publisher or MagicMock(),
        embeddings_collection="embeddings",
        topic_resume_indexed="resume-indexed",
        topic_dlq="dead-letter-queue",
    )


def _make_resume(
    resume_id: str = "abc-123",
    raw_text: str = "John Doe, Python developer",
    metadata: dict[str, Any] | None = None,
) -> MagicMock:
    """Build a mock ResumeDocument."""
    doc = MagicMock()
    doc.id = resume_id
    doc.raw_text = raw_text
    doc.metadata = metadata or {}
    doc.status = "INGESTED"
    return doc


# ---------------------------------------------------------------------------
# _skills_text helper
# ---------------------------------------------------------------------------


def test_skills_text_returns_joined_skills() -> None:
    """_skills_text should join highlight strings with commas."""
    data = {"highlights": ["Python expert", "AWS certified", "Team lead"]}
    assert _skills_text(data) == "Python expert, AWS certified, Team lead"


def test_skills_text_empty_when_no_skills() -> None:
    """_skills_text returns empty string when highlights list is empty."""
    assert _skills_text({}) == ""
    assert _skills_text({"highlights": []}) == ""


def test_skills_text_filters_falsy_values() -> None:
    """_skills_text skips None and empty string highlights."""
    data = {"highlights": ["Python expert", None, "", "Team lead"]}
    assert _skills_text(data) == "Python expert, Team lead"


# ---------------------------------------------------------------------------
# process_resume — happy path
# ---------------------------------------------------------------------------


def test_process_resume_happy_path() -> None:
    """process_resume should run all pipeline steps and publish to resume-indexed."""
    store = MagicMock()
    resume = _make_resume()
    store.get_resume.return_value = resume
    store.update_resume.return_value = resume

    vertex_ai = MagicMock()
    vertex_ai.extract_structured_fields.return_value = {
        "name": "John Doe",
        "highlights": ["Python expert", "Java developer"],
    }
    vertex_ai.generate_embeddings.return_value = [
        [0.1, 0.2],  # full text
        [0.3, 0.4],  # highlights
    ]

    publisher = MagicMock()

    svc = _make_service(store=store, vertex_ai=vertex_ai, publisher=publisher)

    with patch("app.services.ai_worker_service.AIWorkerService._save_embeddings"):
        svc.process_resume("abc-123")

    # Status should be set to PROCESSING first, then PROCESSED.
    update_calls = store.update_resume.call_args_list
    statuses = [c.args[1].status for c in update_calls if c.args[1].status is not None]
    assert STATUS_PROCESSING in statuses
    assert STATUS_PROCESSED in statuses

    # Publisher should be called with resume-indexed topic.
    publisher.publish.assert_called_once_with(
        "resume-indexed", {"resumeId": "abc-123"}
    )


def test_process_resume_generates_embeddings_with_skills() -> None:
    """When skills are present, two embedding texts should be submitted."""
    store = MagicMock()
    resume = _make_resume()
    store.get_resume.return_value = resume
    store.update_resume.return_value = resume

    vertex_ai = MagicMock()
    vertex_ai.extract_structured_fields.return_value = {"highlights": ["Python expert"]}
    vertex_ai.generate_embeddings.return_value = [[0.1], [0.2]]

    svc = _make_service(store=store, vertex_ai=vertex_ai)

    with patch("app.services.ai_worker_service.AIWorkerService._save_embeddings") as mock_save:
        svc.process_resume("abc-123")

    # Two texts: full text and highlights
    vertex_ai.generate_embeddings.assert_called_once()
    args = vertex_ai.generate_embeddings.call_args.args[0]
    assert len(args) == 2


def test_process_resume_generates_only_full_text_embedding_when_no_skills() -> None:
    """When no skills are present, only the full text embedding is generated."""
    store = MagicMock()
    resume = _make_resume()
    store.get_resume.return_value = resume
    store.update_resume.return_value = resume

    vertex_ai = MagicMock()
    vertex_ai.extract_structured_fields.return_value = {"highlights": []}
    vertex_ai.generate_embeddings.return_value = [[0.1]]

    svc = _make_service(store=store, vertex_ai=vertex_ai)

    with patch("app.services.ai_worker_service.AIWorkerService._save_embeddings"):
        svc.process_resume("abc-123")

    args = vertex_ai.generate_embeddings.call_args.args[0]
    assert len(args) == 1


# ---------------------------------------------------------------------------
# process_resume — error handling
# ---------------------------------------------------------------------------


def test_process_resume_handles_extraction_error() -> None:
    """ExtractionError should set status to FAILED and publish to DLQ."""
    store = MagicMock()
    resume = _make_resume()
    store.get_resume.return_value = resume
    store.update_resume.return_value = resume

    vertex_ai = MagicMock()
    vertex_ai.extract_structured_fields.side_effect = ExtractionError("Gemini is down")

    publisher = MagicMock()
    svc = _make_service(store=store, vertex_ai=vertex_ai, publisher=publisher)

    with pytest.raises(ExtractionError):
        svc.process_resume("abc-123")

    # DLQ should be notified.
    publisher.publish.assert_called_once()
    dlq_call = publisher.publish.call_args
    assert dlq_call.args[0] == "dead-letter-queue"
    assert dlq_call.args[1]["resumeId"] == "abc-123"
    assert dlq_call.args[1]["stage"] == "extraction"

    # Firestore status should be FAILED.
    failed_calls = [
        c for c in store.update_resume.call_args_list
        if c.args[1].status == STATUS_FAILED
    ]
    assert len(failed_calls) == 1


def test_process_resume_handles_embedding_error() -> None:
    """EmbeddingError should set status to FAILED and publish to DLQ."""
    store = MagicMock()
    resume = _make_resume()
    store.get_resume.return_value = resume
    store.update_resume.return_value = resume

    vertex_ai = MagicMock()
    vertex_ai.extract_structured_fields.return_value = {"highlights": ["Python expert"]}
    vertex_ai.generate_embeddings.side_effect = EmbeddingError("Quota exceeded")

    publisher = MagicMock()
    svc = _make_service(store=store, vertex_ai=vertex_ai, publisher=publisher)

    with patch("app.services.ai_worker_service.AIWorkerService._save_embeddings"):
        with pytest.raises(EmbeddingError):
            svc.process_resume("abc-123")

    publisher.publish.assert_called_once()
    dlq_call = publisher.publish.call_args
    assert dlq_call.args[0] == "dead-letter-queue"
    assert dlq_call.args[1]["stage"] == "embedding"


def test_process_resume_handles_empty_raw_text() -> None:
    """A resume with empty raw_text should fail with ValueError and update Firestore."""
    store = MagicMock()
    resume = _make_resume(raw_text="   ")
    store.get_resume.return_value = resume
    store.update_resume.return_value = resume

    publisher = MagicMock()
    svc = _make_service(store=store, publisher=publisher)

    with pytest.raises(ValueError, match="empty raw_text"):
        svc.process_resume("abc-123")

    publisher.publish.assert_called_once()
    assert publisher.publish.call_args.args[0] == "dead-letter-queue"


def test_process_resume_dlq_failure_does_not_mask_original_error() -> None:
    """If DLQ publish fails, the original exception is still raised."""
    store = MagicMock()
    resume = _make_resume()
    store.get_resume.return_value = resume
    store.update_resume.return_value = resume

    vertex_ai = MagicMock()
    vertex_ai.extract_structured_fields.side_effect = ExtractionError("boom")

    publisher = MagicMock()
    publisher.publish.side_effect = RuntimeError("DLQ unavailable")

    svc = _make_service(store=store, vertex_ai=vertex_ai, publisher=publisher)

    with pytest.raises(ExtractionError):
        svc.process_resume("abc-123")


# ---------------------------------------------------------------------------
# _save_embeddings
# ---------------------------------------------------------------------------


def test_save_embeddings_calls_firestore() -> None:
    """_save_embeddings should write to the configured Firestore collection."""
    svc = _make_service()

    mock_doc_ref = MagicMock()
    mock_col = MagicMock()
    mock_col.document.return_value = mock_doc_ref
    mock_db = MagicMock()
    mock_db.collection.return_value = mock_col

    # firebase_admin is installed, so patch its firestore.client directly.
    with patch("firebase_admin.firestore.client", return_value=mock_db):
        svc._save_embeddings("abc-123", [0.1, 0.2], [0.3])

    mock_col.document.assert_called_once_with("abc-123")
    mock_doc_ref.set.assert_called_once()
    payload = mock_doc_ref.set.call_args.args[0]
    assert payload["resumeId"] == "abc-123"
    assert payload["fullTextEmbedding"] == [0.1, 0.2]
    assert payload["skillsEmbedding"] == [0.3]


# ---------------------------------------------------------------------------
# process_resume — embedding count mismatch
# ---------------------------------------------------------------------------


def test_process_resume_raises_on_embedding_count_mismatch() -> None:
    """EmbeddingError is raised when generate_embeddings returns fewer vectors than expected."""
    store = MagicMock()
    resume = _make_resume()
    store.get_resume.return_value = resume
    store.update_resume.return_value = resume

    vertex_ai = MagicMock()
    vertex_ai.extract_structured_fields.return_value = {"highlights": ["Python expert"]}
    # Two texts were submitted but only one vector returned.
    vertex_ai.generate_embeddings.return_value = [[0.1, 0.2]]

    publisher = MagicMock()
    svc = _make_service(store=store, vertex_ai=vertex_ai, publisher=publisher)

    with patch("app.services.ai_worker_service.AIWorkerService._save_embeddings"):
        with pytest.raises(EmbeddingError, match="Expected 2 embedding vector"):
            svc.process_resume("abc-123")

    # Status must be set to FAILED after the count mismatch.
    failed_calls = [
        c for c in store.update_resume.call_args_list
        if c.args[1].status == STATUS_FAILED
    ]
    assert len(failed_calls) == 1


# ---------------------------------------------------------------------------
# _update_status — error resilience
# ---------------------------------------------------------------------------


def test_update_status_falls_back_to_extra_metadata_when_get_resume_fails() -> None:
    """_update_status uses extra_metadata directly when get_resume raises."""
    store = MagicMock()
    store.get_resume.side_effect = RuntimeError("Firestore unavailable")

    svc = _make_service(store=store)
    # Should not raise; the fallback path uses extra_metadata as-is.
    svc._update_status("abc-123", "PROCESSING", extra_metadata={"key": "value"})

    store.update_resume.assert_called_once()
    update_data = store.update_resume.call_args.args[1]
    assert update_data.metadata == {"key": "value"}
    assert update_data.status == "PROCESSING"


def test_update_status_swallows_update_resume_failure() -> None:
    """_update_status logs but does not raise when update_resume fails."""
    store = MagicMock()
    store.update_resume.side_effect = RuntimeError("write failed")

    svc = _make_service(store=store)
    # Must not raise.
    svc._update_status("abc-123", "FAILED", extra_metadata={})


# ---------------------------------------------------------------------------
# _save_embeddings — Firestore write failure
# ---------------------------------------------------------------------------


def test_save_embeddings_reraises_on_firestore_failure() -> None:
    """_save_embeddings re-raises when the Firestore .set() call fails."""
    svc = _make_service()

    mock_doc_ref = MagicMock()
    mock_doc_ref.set.side_effect = RuntimeError("Firestore write error")
    mock_col = MagicMock()
    mock_col.document.return_value = mock_doc_ref
    mock_db = MagicMock()
    mock_db.collection.return_value = mock_col

    with patch("firebase_admin.firestore.client", return_value=mock_db):
        with pytest.raises(RuntimeError, match="Firestore write error"):
            svc._save_embeddings("abc-123", [0.1], [0.2])
