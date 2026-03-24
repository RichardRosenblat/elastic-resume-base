"""Unit tests for Synapse persistence initialisation."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

from synapse.persistence import (
    PersistenceOptions,
    _reset_persistence_for_testing,
    get_db,
    get_resume_store,
    initialize_persistence,
    initialize_persistence_from_env,
    terminate_persistence,
)


def _mock_firestore_client() -> MagicMock:
    """Return a mock Firestore client."""
    return MagicMock()


class TestInitializePersistence:
    """Tests for initialize_persistence()."""

    def test_get_db_raises_before_initialization(self) -> None:
        """get_db() raises RuntimeError when not yet initialised."""
        with pytest.raises(RuntimeError, match="not been initialised"):
            get_db()

    def test_get_db_returns_client_after_initialization(self) -> None:
        """get_db() returns the Firestore client after initialization."""
        mock_client = _mock_firestore_client()
        with patch("synapse.persistence._build_firestore_client", return_value=mock_client):
            initialize_persistence(project_id="test-project")
        assert get_db() is mock_client

    def test_idempotent_second_call_is_noop(self) -> None:
        """Calling initialize_persistence() twice does not re-initialise."""
        mock_client = _mock_firestore_client()
        with patch("synapse.persistence._build_firestore_client", return_value=mock_client) as m:
            initialize_persistence(project_id="test-project")
            initialize_persistence(project_id="test-project")
        assert m.call_count == 1

    def test_options_object_takes_precedence(self) -> None:
        """A PersistenceOptions instance overrides keyword args."""
        mock_client = _mock_firestore_client()
        opts = PersistenceOptions(project_id="options-project", resumes_collection="custom")
        with patch("synapse.persistence._build_firestore_client", return_value=mock_client):
            initialize_persistence(project_id="ignored", options=opts)
        from synapse.persistence import _options
        assert _options is not None
        assert _options.project_id == "options-project"
        assert _options.resumes_collection == "custom"

    def test_raises_when_no_project_id(self) -> None:
        """Raises ValueError if no project_id can be determined."""
        env_backup = {k: os.environ.pop(k) for k in ["GCP_PROJECT_ID", "FIREBASE_PROJECT_ID"] if k in os.environ}
        try:
            with pytest.raises(ValueError, match="project_id"):
                initialize_persistence()
        finally:
            os.environ.update(env_backup)

    def test_uses_env_var_project_id(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Uses GCP_PROJECT_ID from environment when no project_id arg is given."""
        monkeypatch.setenv("GCP_PROJECT_ID", "env-project")
        mock_client = _mock_firestore_client()
        with patch("synapse.persistence._build_firestore_client", return_value=mock_client):
            initialize_persistence()
        from synapse.persistence import _options
        assert _options is not None
        assert _options.project_id == "env-project"


class TestTerminatePersistence:
    """Tests for terminate_persistence()."""

    def test_terminate_resets_db(self) -> None:
        """After terminate, get_db() raises RuntimeError again."""
        mock_client = _mock_firestore_client()
        with patch("synapse.persistence._build_firestore_client", return_value=mock_client):
            initialize_persistence(project_id="test-project")
        assert get_db() is mock_client
        terminate_persistence()
        with pytest.raises(RuntimeError):
            get_db()

    def test_terminate_is_idempotent(self) -> None:
        """terminate_persistence() can be called multiple times without error."""
        terminate_persistence()
        terminate_persistence()


class TestGetResumeStore:
    """Tests for get_resume_store()."""

    def test_raises_when_not_initialized(self) -> None:
        """get_resume_store() raises RuntimeError before initialization."""
        with pytest.raises(RuntimeError):
            get_resume_store()

    def test_returns_firestore_resume_store(self) -> None:
        """Returns a FirestoreResumeStore after initialization."""
        from synapse.repositories.firestore_resume_store import FirestoreResumeStore

        mock_client = _mock_firestore_client()
        with patch("synapse.persistence._build_firestore_client", return_value=mock_client):
            initialize_persistence(project_id="test-project")
        store = get_resume_store()
        assert isinstance(store, FirestoreResumeStore)

    def test_store_uses_configured_collection(self) -> None:
        """The store uses the collection configured during initialization."""
        mock_client = _mock_firestore_client()
        with patch("synapse.persistence._build_firestore_client", return_value=mock_client):
            initialize_persistence(project_id="test-project", resumes_collection="my-resumes")
        store = get_resume_store()
        assert store._collection == "my-resumes"


class TestInitializePersistenceFromEnv:
    """Tests for initialize_persistence_from_env()."""

    def test_reads_gcp_project_id(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Reads project ID from GCP_PROJECT_ID environment variable."""
        monkeypatch.setenv("GCP_PROJECT_ID", "env-project-gcp")
        monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)
        mock_client = _mock_firestore_client()
        with patch("synapse.persistence._build_firestore_client", return_value=mock_client):
            initialize_persistence_from_env()
        from synapse.persistence import _options
        assert _options is not None
        assert _options.project_id == "env-project-gcp"

    def test_reads_custom_collection(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Reads collection name from FIRESTORE_RESUMES_COLLECTION."""
        monkeypatch.setenv("GCP_PROJECT_ID", "env-project")
        monkeypatch.setenv("FIRESTORE_RESUMES_COLLECTION", "custom-col")
        mock_client = _mock_firestore_client()
        with patch("synapse.persistence._build_firestore_client", return_value=mock_client):
            initialize_persistence_from_env()
        from synapse.persistence import _options
        assert _options is not None
        assert _options.resumes_collection == "custom-col"
