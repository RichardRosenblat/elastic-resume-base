"""Unit tests for the search router."""

from unittest.mock import MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_search_endpoint_success(app_client):
    """Test that the search endpoint returns results."""
    with patch("app.routers.search.get_search_service") as mock_get_service:
        # Mock search service
        mock_service = MagicMock()
        mock_get_service.return_value = mock_service

        # Mock embedding generation
        mock_service.generate_query_embedding.return_value = [0.1] * 768

        # Mock search results
        mock_service.search.return_value = [
            ("resume-1", 0.95),
            ("resume-2", 0.85),
        ]

        # Mock metadata fetching
        def get_metadata(resume_id):
            return {
                "name": f"Candidate {resume_id}",
                "skills": ["Python", "Java"],
            }

        mock_service.get_resume_metadata.side_effect = get_metadata

        async with app_client as client:
            response = await client.get(
                "/api/v1/search",
                params={"q": "Python developer", "limit": 10},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["query"] == "Python developer"
        assert data["data"]["total"] == 2
        assert len(data["data"]["results"]) == 2
        assert data["data"]["results"][0]["resumeId"] == "resume-1"
        assert data["data"]["results"][0]["score"] == 0.95


@pytest.mark.asyncio
async def test_search_endpoint_missing_query(app_client):
    """Test that missing query parameter returns 422."""
    async with app_client as client:
        response = await client.get("/api/v1/search")

    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_rebuild_index_endpoint_success(app_client):
    """Test that the rebuild endpoint triggers index rebuild."""
    with patch("app.routers.search.get_search_service") as mock_get_service:
        # Mock search service
        mock_service = MagicMock()
        mock_get_service.return_value = mock_service

        async with app_client as client:
            response = await client.post("/api/v1/index/rebuild")

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["status"] == "rebuilt"

        # Verify service was called
        mock_service.rebuild_index_from_firestore.assert_called_once()
