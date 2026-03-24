"""Shared pytest fixtures for AI Worker unit tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.resume import StructuredResumeFields
from app.services.ai_worker_service import AIWorkerService
from app.services.vertex_ai_service import VertexAIService
from synapse.interfaces.resume_document_store import IResumeDocumentStore, ResumeDocument
from synapse.interfaces.resume_embedding_store import IResumeEmbeddingStore


@pytest.fixture()
def mock_resume_store() -> MagicMock:
    """Return a MagicMock that satisfies IResumeDocumentStore."""
    store = MagicMock(spec=IResumeDocumentStore)
    store.get_by_id = AsyncMock()
    store.update_status = AsyncMock()
    store.save_structured_data = AsyncMock()
    store.save_error = AsyncMock()
    return store


@pytest.fixture()
def mock_embedding_store() -> MagicMock:
    """Return a MagicMock that satisfies IResumeEmbeddingStore."""
    store = MagicMock(spec=IResumeEmbeddingStore)
    store.save_embedding = AsyncMock()
    return store


@pytest.fixture()
def mock_vertex_ai() -> MagicMock:
    """Return a MagicMock that mimics VertexAIService."""
    service = MagicMock(spec=VertexAIService)
    service.extract_fields = AsyncMock(
        return_value=StructuredResumeFields(
            name="Jane Doe",
            email="jane@example.com",
            skills=["Python", "FastAPI"],
        )
    )
    service.generate_embedding = AsyncMock(return_value=[0.1, 0.2, 0.3])
    return service


@pytest.fixture()
def mock_pubsub() -> MagicMock:
    """Return a MagicMock that satisfies IPubSubService."""
    from hermes.interfaces.pubsub_service import IPubSubService

    service = MagicMock(spec=IPubSubService)
    service.publish = AsyncMock(return_value="msg-id-001")
    return service


@pytest.fixture()
def sample_resume() -> ResumeDocument:
    """Return a minimal INGESTED resume document."""
    return ResumeDocument(
        resume_id="resume-test-001",
        status="INGESTED",
        raw_text="Jane Doe — Software Engineer with 5 years of Python experience.",
    )


@pytest.fixture()
def worker_service(
    mock_resume_store: MagicMock,
    mock_embedding_store: MagicMock,
    mock_vertex_ai: MagicMock,
    mock_pubsub: MagicMock,
) -> AIWorkerService:
    """Return a fully-wired AIWorkerService with mocked dependencies."""
    return AIWorkerService(
        resume_store=mock_resume_store,
        embedding_store=mock_embedding_store,
        vertex_ai=mock_vertex_ai,
        pubsub=mock_pubsub,
        output_topic="resume_indexing",
        dlq_alert_recipient="ops@example.com",
    )
