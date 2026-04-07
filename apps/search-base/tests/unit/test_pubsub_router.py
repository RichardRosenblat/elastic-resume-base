"""Unit tests for the Pub/Sub router."""

from unittest.mock import MagicMock, patch

import pytest

from app.models.pubsub import PubSubPushEnvelope


def _make_push_body(resume_id: str) -> dict:
    """Create a Pub/Sub push message body.

    Args:
        resume_id: Resume ID to include in the message.

    Returns:
        Dictionary representing the Pub/Sub push envelope.
    """
    import base64
    import json

    payload = {"resumeId": resume_id}
    data_b64 = base64.b64encode(json.dumps(payload).encode()).decode()

    return {
        "message": {
            "data": data_b64,
            "messageId": "123456789",
            "publishTime": "2024-01-01T00:00:00.000Z",
            "attributes": {},
        },
        "subscription": "projects/test-project/subscriptions/test-sub",
    }


@pytest.mark.asyncio
async def test_pubsub_push_success(app_client):
    """Test that the Pub/Sub push endpoint successfully indexes a resume."""
    with patch("app.routers.pubsub.get_search_service") as mock_get_service:
        with patch("app.routers.pubsub.firestore.client") as mock_firestore_client:
            # Mock search service
            mock_service = MagicMock()
            mock_get_service.return_value = mock_service

            # Mock Firestore
            mock_db = MagicMock()
            mock_firestore_client.return_value = mock_db

            mock_collection = MagicMock()
            mock_db.collection.return_value = mock_collection

            mock_doc_ref = MagicMock()
            mock_collection.document.return_value = mock_doc_ref

            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {"fullTextEmbedding": [0.1] * 768}
            mock_doc_ref.get.return_value = mock_doc

            async with app_client as client:
                response = await client.post(
                    "/api/v1/pubsub/push",
                    json=_make_push_body("resume-123"),
                )

            assert response.status_code == 200
            data = response.json()
            assert data["data"]["resumeId"] == "resume-123"
            assert data["data"]["status"] == "indexed"

            # Verify service was called
            mock_service.add_resume_embedding.assert_called_once()


@pytest.mark.asyncio
async def test_pubsub_push_embedding_not_found(app_client):
    """Test that missing embedding returns 200 (permanent error)."""
    with patch("app.routers.pubsub.get_search_service") as mock_get_service:
        with patch("app.routers.pubsub.firestore.client") as mock_firestore_client:
            # Mock search service
            mock_service = MagicMock()
            mock_get_service.return_value = mock_service

            # Mock Firestore - document not found
            mock_db = MagicMock()
            mock_firestore_client.return_value = mock_db

            mock_collection = MagicMock()
            mock_db.collection.return_value = mock_collection

            mock_doc_ref = MagicMock()
            mock_collection.document.return_value = mock_doc_ref

            mock_doc = MagicMock()
            mock_doc.exists = False
            mock_doc_ref.get.return_value = mock_doc

            async with app_client as client:
                response = await client.post(
                    "/api/v1/pubsub/push",
                    json=_make_push_body("resume-999"),
                )

            # Should return 200 (acknowledge) for permanent error
            assert response.status_code == 200
            data = response.json()
            assert data["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_pubsub_push_malformed_envelope(app_client):
    """Test that malformed Pub/Sub envelope returns 400."""
    async with app_client as client:
        response = await client.post(
            "/api/v1/pubsub/push",
            json={"invalid": "envelope"},
        )

    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "BAD_REQUEST"
