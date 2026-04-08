"""Shared pytest fixtures for the AI Worker service tests."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def app_client() -> AsyncClient:
    """Return an AsyncClient configured for the FastAPI app."""
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
