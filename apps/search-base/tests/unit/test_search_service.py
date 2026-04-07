"""Unit tests for the SearchService class."""

from unittest.mock import MagicMock, Mock, patch

import numpy as np
import pytest

from app.services.search_service import SearchService
from app.utils.exceptions import (
    EmbeddingGenerationError,
    FaissIndexError,
    IndexNotReadyError,
)


@patch("app.services.search_service.firestore.client")
def test_initialize_creates_empty_index(mock_firestore_client):
    """Test that initialize creates an empty FAISS index."""
    mock_firestore_client.return_value = MagicMock()

    service = SearchService(embedding_dim=768, index_path="")
    service.initialize()

    assert service._index is not None
    assert service._index.ntotal == 0
    assert len(service._resume_ids) == 0


@patch("app.services.search_service.firestore.client")
def test_add_resume_embedding_success(mock_firestore_client):
    """Test adding a resume embedding to the index."""
    mock_firestore_client.return_value = MagicMock()

    service = SearchService(embedding_dim=768, index_path="")
    service.initialize()

    embedding = [0.1] * 768
    service.add_resume_embedding("resume-123", embedding)

    assert service._index.ntotal == 1
    assert len(service._resume_ids) == 1
    assert service._resume_ids[0] == "resume-123"


@patch("app.services.search_service.firestore.client")
def test_add_resume_embedding_wrong_dimension(mock_firestore_client):
    """Test that adding an embedding with wrong dimension raises error."""
    mock_firestore_client.return_value = MagicMock()

    service = SearchService(embedding_dim=768, index_path="")
    service.initialize()

    embedding = [0.1] * 512  # Wrong dimension

    with pytest.raises(FaissIndexError, match="dimension mismatch"):
        service.add_resume_embedding("resume-123", embedding)


@patch("app.services.search_service.firestore.client")
def test_add_resume_embedding_duplicate_skipped(mock_firestore_client):
    """Test that duplicate resume IDs are skipped."""
    mock_firestore_client.return_value = MagicMock()

    service = SearchService(embedding_dim=768, index_path="")
    service.initialize()

    embedding = [0.1] * 768
    service.add_resume_embedding("resume-123", embedding)
    service.add_resume_embedding("resume-123", embedding)

    # Should only have one entry
    assert service._index.ntotal == 1
    assert len(service._resume_ids) == 1


@patch("app.services.search_service.firestore.client")
def test_search_success(mock_firestore_client):
    """Test searching the index returns ranked results."""
    mock_firestore_client.return_value = MagicMock()

    service = SearchService(embedding_dim=768, index_path="", metric="cosine")
    service.initialize()

    # Add some embeddings
    embedding1 = [1.0] + [0.0] * 767
    embedding2 = [0.0] + [1.0] + [0.0] * 766
    service.add_resume_embedding("resume-1", embedding1)
    service.add_resume_embedding("resume-2", embedding2)

    # Search with query similar to embedding1
    query = [0.9] + [0.0] * 767
    results = service.search(query, top_k=2)

    assert len(results) == 2
    # First result should be resume-1 (more similar)
    assert results[0][0] == "resume-1"
    assert results[0][1] > results[1][1]  # Higher score for more similar


@patch("app.services.search_service.firestore.client")
def test_search_empty_index_raises_error(mock_firestore_client):
    """Test that searching an empty index raises IndexNotReadyError."""
    mock_firestore_client.return_value = MagicMock()

    service = SearchService(embedding_dim=768, index_path="")
    service.initialize()

    query = [0.1] * 768

    with pytest.raises(IndexNotReadyError, match="Index is empty"):
        service.search(query, top_k=10)


@patch("app.services.search_service.firestore.client")
def test_search_wrong_query_dimension(mock_firestore_client):
    """Test that searching with wrong query dimension raises error."""
    mock_firestore_client.return_value = MagicMock()

    service = SearchService(embedding_dim=768, index_path="")
    service.initialize()
    service.add_resume_embedding("resume-1", [0.1] * 768)

    query = [0.1] * 512  # Wrong dimension

    with pytest.raises(FaissIndexError, match="dimension mismatch"):
        service.search(query, top_k=10)


@patch("app.services.search_service.firestore.client")
def test_normalize_vector_for_cosine(mock_firestore_client):
    """Test L2 normalization for cosine similarity."""
    mock_firestore_client.return_value = MagicMock()

    service = SearchService(embedding_dim=768, metric="cosine")
    vector = np.array([[3.0, 4.0] + [0.0] * 766])
    normalized = service._normalize_vector(vector)

    # Length should be 1 (3^2 + 4^2 = 25, sqrt(25) = 5)
    expected = np.array([[0.6, 0.8] + [0.0] * 766])
    np.testing.assert_array_almost_equal(normalized, expected)


@patch("app.services.search_service.firestore.client")
def test_normalize_vector_for_l2_does_nothing(mock_firestore_client):
    """Test that L2 metric does not normalize vectors."""
    mock_firestore_client.return_value = MagicMock()

    service = SearchService(embedding_dim=768, metric="l2")
    vector = np.array([[3.0, 4.0] + [0.0] * 766])
    result = service._normalize_vector(vector)

    np.testing.assert_array_equal(result, vector)


@patch("app.services.search_service.firestore.client")
def test_rebuild_index_from_firestore(mock_firestore_client):
    """Test rebuilding the index from Firestore."""
    # Mock Firestore
    mock_db = MagicMock()
    mock_firestore_client.return_value = mock_db

    mock_collection = MagicMock()
    mock_db.collection.return_value = mock_collection

    # Mock documents
    mock_doc1 = Mock()
    mock_doc1.id = "resume-1"
    mock_doc1.to_dict.return_value = {"fullTextEmbedding": [0.1] * 768}

    mock_doc2 = Mock()
    mock_doc2.id = "resume-2"
    mock_doc2.to_dict.return_value = {"fullTextEmbedding": [0.2] * 768}

    mock_collection.stream.return_value = [mock_doc1, mock_doc2]

    service = SearchService(embedding_dim=768, index_path="")
    service.initialize()
    service.rebuild_index_from_firestore()

    assert service._index.ntotal == 2
    assert len(service._resume_ids) == 2
    assert "resume-1" in service._resume_ids
    assert "resume-2" in service._resume_ids


@patch("app.services.search_service.firestore.client")
def test_get_resume_metadata_success(mock_firestore_client):
    """Test fetching resume metadata from Firestore."""
    # Mock Firestore
    mock_db = MagicMock()
    mock_firestore_client.return_value = mock_db

    mock_collection = MagicMock()
    mock_db.collection.return_value = mock_collection

    mock_doc_ref = MagicMock()
    mock_collection.document.return_value = mock_doc_ref

    mock_doc = Mock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {
        "metadata": {
            "structuredData": {
                "name": "John Doe",
                "skills": ["Python", "Java"],
            }
        }
    }
    mock_doc_ref.get.return_value = mock_doc

    service = SearchService(embedding_dim=768)
    metadata = service.get_resume_metadata("resume-123")

    assert metadata["name"] == "John Doe"
    assert metadata["skills"] == ["Python", "Java"]


@patch("app.services.search_service.firestore.client")
def test_get_resume_metadata_not_found(mock_firestore_client):
    """Test fetching metadata for non-existent resume raises error."""
    # Mock Firestore
    mock_db = MagicMock()
    mock_firestore_client.return_value = mock_db

    mock_collection = MagicMock()
    mock_db.collection.return_value = mock_collection

    mock_doc_ref = MagicMock()
    mock_collection.document.return_value = mock_doc_ref

    mock_doc = Mock()
    mock_doc.exists = False
    mock_doc_ref.get.return_value = mock_doc

    service = SearchService(embedding_dim=768)

    with pytest.raises(ValueError, match="Resume not found"):
        service.get_resume_metadata("resume-999")


@patch("app.services.search_service.firestore.client")
def test_generate_query_embedding_success(mock_firestore_client):
    """Test generating a query embedding using Vertex AI."""
    mock_firestore_client.return_value = MagicMock()

    # Mock vertexai and TextEmbeddingModel from inside generate_query_embedding
    with patch("vertexai.init") as mock_init:
        with patch("vertexai.language_models.TextEmbeddingModel.from_pretrained") as mock_from_pretrained:
            mock_model = MagicMock()
            mock_from_pretrained.return_value = mock_model

            mock_embedding = Mock()
            mock_embedding.values = [0.1] * 768
            mock_model.get_embeddings.return_value = [mock_embedding]

            service = SearchService(embedding_dim=768)
            embedding = service.generate_query_embedding("Python developer")

            assert len(embedding) == 768
            assert embedding == [0.1] * 768
            # Verify vertexai.init was called
            mock_init.assert_called_once()


@patch("app.services.search_service.firestore.client")
def test_generate_query_embedding_failure(mock_firestore_client):
    """Test that embedding generation failure raises error."""
    mock_firestore_client.return_value = MagicMock()

    # Mock Vertex AI to raise exception
    with patch("vertexai.init"):
        with patch("vertexai.language_models.TextEmbeddingModel.from_pretrained") as mock_from_pretrained:
            mock_from_pretrained.side_effect = Exception("API error")

            service = SearchService(embedding_dim=768)

            with pytest.raises(EmbeddingGenerationError, match="Embedding generation failed"):
                service.generate_query_embedding("Python developer")
