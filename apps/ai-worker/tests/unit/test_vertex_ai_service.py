"""Unit tests for VertexAIService."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from app.services.vertex_ai_service import VertexAIService
from app.utils.exceptions import EmbeddingError, ExtractionError


@pytest.fixture
def svc() -> VertexAIService:
    """Return a VertexAIService instance (not yet initialised)."""
    return VertexAIService(
        project_id="test-project",
        location="us-central1",
        extraction_model="gemini-1.5-flash",
        embedding_model="text-multilingual-embedding-002",
    )


# ---------------------------------------------------------------------------
# initialize
# ---------------------------------------------------------------------------


def test_initialize_idempotent(svc: VertexAIService) -> None:
    """Calling initialize() twice should not raise."""
    with patch("app.services.vertex_ai_service.VertexAIService.initialize") as mock_init:
        mock_init.return_value = None
        svc.initialize()
        svc.initialize()
        assert mock_init.call_count == 2


def test_initialize_sets_flag() -> None:
    """initialize() should set _initialized to True."""
    svc = VertexAIService("p", "l", "m", "em")

    with patch("vertexai.init"):
        import importlib
        import sys

        # Provide a mock vertexai module so the import inside initialize() works.
        mock_vertexai = MagicMock()
        sys.modules.setdefault("vertexai", mock_vertexai)
        svc.initialize()

    assert svc._initialized is True


# ---------------------------------------------------------------------------
# extract_structured_fields
# ---------------------------------------------------------------------------


def test_extract_raises_when_not_initialized(svc: VertexAIService) -> None:
    """extract_structured_fields should raise RuntimeError if not initialised."""
    with pytest.raises(RuntimeError, match="not been initialised"):
        svc.extract_structured_fields("some text")


def test_extract_returns_parsed_json() -> None:
    """extract_structured_fields should return parsed JSON from model response."""
    svc = VertexAIService("p", "l", "m", "em")
    svc._initialized = True

    expected = {"name": "John Doe", "skills": ["Python"]}
    mock_response = MagicMock()
    mock_response.text = json.dumps(expected)
    mock_model = MagicMock()
    mock_model.generate_content.return_value = mock_response

    with patch(
        "app.services.vertex_ai_service.VertexAIService.extract_structured_fields",
        return_value=expected,
    ):
        result = svc.extract_structured_fields("John Doe...")

    assert result == expected


def test_extract_strips_markdown_fences() -> None:
    """extract_structured_fields should strip ```json ... ``` fences."""
    svc = VertexAIService("p", "l", "m", "em")
    svc._initialized = True

    payload = {"name": "Jane"}
    model_text = f"```json\n{json.dumps(payload)}\n```"

    mock_response = MagicMock()
    mock_response.text = model_text
    mock_model_cls = MagicMock(return_value=MagicMock(generate_content=MagicMock(return_value=mock_response)))

    with patch.dict("sys.modules", {"vertexai.generative_models": MagicMock(GenerativeModel=mock_model_cls)}):
        result = svc.extract_structured_fields("Jane resume")

    assert result == payload


def test_extract_raises_extraction_error_on_invalid_json() -> None:
    """extract_structured_fields raises ExtractionError when response is not JSON."""
    svc = VertexAIService("p", "l", "m", "em")
    svc._initialized = True

    mock_response = MagicMock()
    mock_response.text = "not valid json"
    mock_model_cls = MagicMock(
        return_value=MagicMock(generate_content=MagicMock(return_value=mock_response))
    )

    with patch.dict("sys.modules", {"vertexai.generative_models": MagicMock(GenerativeModel=mock_model_cls)}):
        with pytest.raises(ExtractionError, match="Could not parse"):
            svc.extract_structured_fields("some resume text")


def test_extract_raises_extraction_error_on_api_failure() -> None:
    """extract_structured_fields raises ExtractionError when Gemini call fails."""
    svc = VertexAIService("p", "l", "m", "em")
    svc._initialized = True

    mock_model_cls = MagicMock(
        return_value=MagicMock(generate_content=MagicMock(side_effect=RuntimeError("API down")))
    )

    with patch.dict("sys.modules", {"vertexai.generative_models": MagicMock(GenerativeModel=mock_model_cls)}):
        with pytest.raises(ExtractionError, match="Gemini extraction failed"):
            svc.extract_structured_fields("text")


# ---------------------------------------------------------------------------
# generate_embeddings
# ---------------------------------------------------------------------------


def test_generate_embeddings_raises_when_not_initialized(svc: VertexAIService) -> None:
    """generate_embeddings should raise RuntimeError if not initialised."""
    with pytest.raises(RuntimeError, match="not been initialised"):
        svc.generate_embeddings(["text"])


def test_generate_embeddings_returns_empty_for_empty_input() -> None:
    """generate_embeddings should return [] when given an empty list."""
    svc = VertexAIService("p", "l", "m", "em")
    svc._initialized = True

    result = svc.generate_embeddings([])
    assert result == []


def test_generate_embeddings_returns_vectors() -> None:
    """generate_embeddings returns a list of float vectors."""
    svc = VertexAIService("p", "l", "m", "em")
    svc._initialized = True

    fake_embedding = MagicMock()
    fake_embedding.values = [0.1, 0.2, 0.3]
    mock_model = MagicMock()
    mock_model.get_embeddings.return_value = [fake_embedding]
    mock_model_cls = MagicMock(from_pretrained=MagicMock(return_value=mock_model))

    with patch.dict("sys.modules", {"vertexai.language_models": MagicMock(TextEmbeddingModel=mock_model_cls)}):
        result = svc.generate_embeddings(["hello world"])

    assert result == [[0.1, 0.2, 0.3]]


def test_generate_embeddings_raises_embedding_error_on_failure() -> None:
    """generate_embeddings raises EmbeddingError when the API call fails."""
    svc = VertexAIService("p", "l", "m", "em")
    svc._initialized = True

    mock_model_cls = MagicMock(
        from_pretrained=MagicMock(
            return_value=MagicMock(get_embeddings=MagicMock(side_effect=RuntimeError("quota exceeded")))
        )
    )

    with patch.dict("sys.modules", {"vertexai.language_models": MagicMock(TextEmbeddingModel=mock_model_cls)}):
        with pytest.raises(EmbeddingError, match="Embedding generation failed"):
            svc.generate_embeddings(["text"])
