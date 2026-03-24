"""Shared pytest fixtures for Ingestor Service tests."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from hermes import _reset_pubsub_for_testing
from hermes.interfaces.event_publisher import IEventPublisher, PublishPayload

from app.config import Settings
from app.main import create_app
from app.services.drive_service import DriveService
from app.services.ingest_service import IngestService
from app.services.resume_store import ResumeStore
from app.services.sheets_service import SheetsService


# ---------------------------------------------------------------------------
# Hermes isolation
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_pubsub_singleton() -> None:
    """Ensure the Hermes Pub/Sub singleton is reset before/after every test."""
    _reset_pubsub_for_testing()
    yield
    _reset_pubsub_for_testing()


# ---------------------------------------------------------------------------
# Mock implementations
# ---------------------------------------------------------------------------


class MockEventPublisher:
    """In-memory event publisher that records published messages."""

    def __init__(self) -> None:
        self.published: list[tuple[str, PublishPayload]] = []

    def publish(self, topic: str, payload: PublishPayload) -> str:
        self.published.append((topic, payload))
        return f"mock-msg-{len(self.published)}"


@pytest.fixture()
def mock_publisher() -> MockEventPublisher:
    """Return a fresh MockEventPublisher for each test."""
    return MockEventPublisher()


@pytest.fixture()
def mock_sheets_client() -> MagicMock:
    """Return a mock Google Sheets API client."""
    return MagicMock()


@pytest.fixture()
def mock_drive_client() -> MagicMock:
    """Return a mock Google Drive API client."""
    return MagicMock()


@pytest.fixture()
def mock_db() -> MagicMock:
    """Return a mock Firestore client."""
    db = MagicMock()
    # Default: doc.id returns a unique ID string
    doc_ref = MagicMock()
    doc_ref.id = "resume-test-001"
    db.collection.return_value.document.return_value = doc_ref
    return db


@pytest.fixture()
def sheets_service(mock_sheets_client: MagicMock) -> SheetsService:
    return SheetsService(sheets_client=mock_sheets_client)


@pytest.fixture()
def drive_service(mock_drive_client: MagicMock) -> DriveService:
    return DriveService(drive_client=mock_drive_client)


@pytest.fixture()
def resume_store(mock_db: MagicMock) -> ResumeStore:
    return ResumeStore(db=mock_db, collection="resumes")


@pytest.fixture()
def ingest_service(
    sheets_service: SheetsService,
    drive_service: DriveService,
    resume_store: ResumeStore,
    mock_publisher: MockEventPublisher,
) -> IngestService:
    return IngestService(
        sheets=sheets_service,
        drive=drive_service,
        store=resume_store,
        publisher=mock_publisher,  # type: ignore[arg-type]
        ingestor_topic="resume-ingested",
        dlq_topic="dead-letter-queue",
    )


@pytest.fixture()
def test_settings() -> Settings:
    return Settings(
        port=8001,
        gcp_project_id="test-project",
        firestore_resumes_collection="resumes",
        pubsub_ingestor_topic="resume-ingested",
        pubsub_dlq_topic="dead-letter-queue",
    )


@pytest.fixture()
def test_client(
    test_settings: Settings,
    ingest_service: IngestService,
) -> TestClient:
    """Return a Starlette TestClient wired up with mock services."""
    app = create_app(settings=test_settings, ingest_service=ingest_service)
    return TestClient(app, raise_server_exceptions=False)
