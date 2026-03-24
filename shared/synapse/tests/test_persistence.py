"""Unit tests for synapse.persistence."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from synapse.persistence import (
    PersistenceOptions,
    _reset_persistence_for_testing,
    get_db,
    initialize_persistence,
    terminate_persistence,
)


class TestInitializePersistence:
    """Tests for initialize_persistence()."""

    def test_creates_firestore_client(self) -> None:
        """initialize_persistence creates an AsyncClient."""
        with patch("synapse.persistence.firestore") as mock_fs:
            mock_client = MagicMock()
            mock_fs.AsyncClient.return_value = mock_client
            initialize_persistence(PersistenceOptions(project_id="demo"))
        mock_fs.AsyncClient.assert_called_once_with(project="demo")

    def test_is_idempotent(self) -> None:
        """Second call is a no-op — client created only once."""
        with patch("synapse.persistence.firestore") as mock_fs:
            mock_fs.AsyncClient.return_value = MagicMock()
            initialize_persistence(PersistenceOptions(project_id="demo"))
            initialize_persistence(PersistenceOptions(project_id="demo"))
        mock_fs.AsyncClient.assert_called_once()

    def test_sets_emulator_host_env_var(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """emulator_host sets FIRESTORE_EMULATOR_HOST before creating the client."""
        monkeypatch.delenv("FIRESTORE_EMULATOR_HOST", raising=False)
        with patch("synapse.persistence.firestore") as mock_fs:
            mock_fs.AsyncClient.return_value = MagicMock()
            initialize_persistence(
                PersistenceOptions(project_id="demo", emulator_host="localhost:8080")
            )
        import os
        assert os.environ.get("FIRESTORE_EMULATOR_HOST") == "localhost:8080"


class TestGetDb:
    """Tests for get_db()."""

    def test_raises_when_not_initialised(self) -> None:
        """get_db raises RuntimeError before initialize_persistence is called."""
        with pytest.raises(RuntimeError, match="not been initialised"):
            get_db()

    def test_returns_client_after_initialisation(self) -> None:
        """get_db returns the client after initialize_persistence."""
        with patch("synapse.persistence.firestore") as mock_fs:
            mock_client = MagicMock()
            mock_fs.AsyncClient.return_value = mock_client
            initialize_persistence(PersistenceOptions(project_id="demo"))
            assert get_db() is mock_client


class TestTerminatePersistence:
    """Tests for terminate_persistence()."""

    @pytest.mark.asyncio
    async def test_closes_client_and_clears_singleton(self) -> None:
        """terminate_persistence closes the client and resets the singleton."""
        with patch("synapse.persistence.firestore") as mock_fs:
            mock_client = MagicMock()
            mock_fs.AsyncClient.return_value = mock_client
            initialize_persistence(PersistenceOptions(project_id="demo"))
            await terminate_persistence()

        mock_client.close.assert_called_once()
        with pytest.raises(RuntimeError):
            get_db()

    @pytest.mark.asyncio
    async def test_is_idempotent_when_not_initialised(self) -> None:
        """terminate_persistence is safe to call before initialisation."""
        await terminate_persistence()  # Should not raise
