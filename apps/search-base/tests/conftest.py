"""Pytest configuration and shared fixtures."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def app_client() -> AsyncClient:
    """Create an async HTTP client for testing the FastAPI app.

    Returns:
        AsyncClient configured to communicate with the test app.
    """
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
