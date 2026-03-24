"""Shared pytest fixtures for AI Worker unit tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.resume import ResumeDocument, ResumeStatus, StructuredResumeFields
from app.repositories.resume_repository import ResumeRepository
from app.services.ai_worker_service import AIWorkerService
from app.services.pubsub_service import PubSubService
from app.services.vertex_ai_service import VertexAIService


@pytest.fixture()
def mock_resume_repo() -> MagicMock:
    """Return a MagicMock that mimics ResumeRepository."""
    repo = MagicMock(spec=ResumeRepository)
    repo.get_by_id = AsyncMock()
    repo.update_status = AsyncMock()
    repo.save_processed_data = AsyncMock()
    repo.save_error = AsyncMock()
    return repo


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
    """Return a MagicMock that mimics PubSubService."""
    service = MagicMock(spec=PubSubService)
    service.publish = AsyncMock()
    return service


@pytest.fixture()
def sample_resume() -> ResumeDocument:
    """Return a minimal INGESTED resume document."""
    return ResumeDocument(
        resume_id="resume-test-001",
        status=ResumeStatus.INGESTED,
        raw_text="Jane Doe — Software Engineer with 5 years of Python experience.",
    )


@pytest.fixture()
def worker_service(
    mock_resume_repo: MagicMock,
    mock_vertex_ai: MagicMock,
    mock_pubsub: MagicMock,
) -> AIWorkerService:
    """Return a fully-wired AIWorkerService with mocked dependencies."""
    return AIWorkerService(
        resume_repo=mock_resume_repo,
        vertex_ai=mock_vertex_ai,
        pubsub=mock_pubsub,
        output_topic="resume-indexed",
        dlq_alert_recipient="ops@example.com",
    )
