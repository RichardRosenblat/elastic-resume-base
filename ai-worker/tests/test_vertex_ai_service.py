"""Unit tests for the VertexAIService."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from app.services.vertex_ai_service import VertexAIService, VertexAIServiceError


def _make_service() -> VertexAIService:
    """Return a VertexAIService with a mocked vertexai.init call."""
    with patch("app.services.vertex_ai_service.vertexai"):
        return VertexAIService(
            project_id="demo",
            location="us-central1",
            extraction_model="gemini-1.5-flash",
            embedding_model="text-multilingual-embedding-002",
        )


class TestExtractFields:
    """Tests for VertexAIService.extract_fields()."""

    @pytest.mark.asyncio
    async def test_returns_structured_fields_from_valid_json_response(self) -> None:
        """extract_fields parses the model JSON into a StructuredResumeFields."""
        payload = {
            "name": "Jane Doe",
            "email": "jane@example.com",
            "skills": ["Python", "FastAPI"],
            "languages": [],
            "work_experience": [],
            "education": [],
            "certifications": [],
        }
        mock_response = MagicMock()
        mock_response.text = json.dumps(payload)

        with patch("app.services.vertex_ai_service.GenerativeModel") as mock_model_cls:
            mock_model = MagicMock()
            mock_model.generate_content.return_value = mock_response
            mock_model_cls.return_value = mock_model

            service = _make_service()
            result = await service.extract_fields("Jane Doe resume text")

        assert result.name == "Jane Doe"
        assert result.email == "jane@example.com"
        assert "Python" in result.skills

    @pytest.mark.asyncio
    async def test_strips_markdown_code_fence_from_response(self) -> None:
        """extract_fields handles responses wrapped in markdown code fences."""
        payload = {"name": "Bob", "skills": []}
        mock_response = MagicMock()
        mock_response.text = f"```json\n{json.dumps(payload)}\n```"

        with patch("app.services.vertex_ai_service.GenerativeModel") as mock_model_cls:
            mock_model = MagicMock()
            mock_model.generate_content.return_value = mock_response
            mock_model_cls.return_value = mock_model

            service = _make_service()
            result = await service.extract_fields("Bob resume text")

        assert result.name == "Bob"

    @pytest.mark.asyncio
    async def test_raises_value_error_when_raw_text_is_empty(self) -> None:
        """extract_fields raises ValueError for empty raw_text."""
        service = _make_service()
        with pytest.raises(ValueError, match="raw_text must not be empty"):
            await service.extract_fields("")

    @pytest.mark.asyncio
    async def test_raises_value_error_when_raw_text_is_whitespace(self) -> None:
        """extract_fields raises ValueError for whitespace-only raw_text."""
        service = _make_service()
        with pytest.raises(ValueError, match="raw_text must not be empty"):
            await service.extract_fields("   ")

    @pytest.mark.asyncio
    async def test_raises_vertex_ai_error_when_model_call_fails(self) -> None:
        """extract_fields raises VertexAIServiceError when the model raises."""
        with patch("app.services.vertex_ai_service.GenerativeModel") as mock_model_cls:
            mock_model = MagicMock()
            mock_model.generate_content.side_effect = RuntimeError("model unavailable")
            mock_model_cls.return_value = mock_model

            service = _make_service()
            with pytest.raises(VertexAIServiceError, match="extraction failed"):
                await service.extract_fields("Some resume text")

    @pytest.mark.asyncio
    async def test_raises_vertex_ai_error_on_non_json_response(self) -> None:
        """extract_fields raises VertexAIServiceError when JSON parsing fails."""
        mock_response = MagicMock()
        mock_response.text = "This is not JSON at all."

        with patch("app.services.vertex_ai_service.GenerativeModel") as mock_model_cls:
            mock_model = MagicMock()
            mock_model.generate_content.return_value = mock_response
            mock_model_cls.return_value = mock_model

            service = _make_service()
            with pytest.raises(VertexAIServiceError, match="non-JSON"):
                await service.extract_fields("Some resume text")


class TestGenerateEmbedding:
    """Tests for VertexAIService.generate_embedding()."""

    @pytest.mark.asyncio
    async def test_returns_float_list_from_model(self) -> None:
        """generate_embedding returns the embedding values from the model."""
        mock_embedding = MagicMock()
        mock_embedding.values = [0.1, 0.2, 0.3]

        with patch("app.services.vertex_ai_service.TextEmbeddingModel") as mock_cls:
            mock_model = MagicMock()
            mock_model.get_embeddings.return_value = [mock_embedding]
            mock_cls.from_pretrained.return_value = mock_model

            service = _make_service()
            result = await service.generate_embedding("Some text")

        assert result == [0.1, 0.2, 0.3]

    @pytest.mark.asyncio
    async def test_raises_value_error_for_empty_text(self) -> None:
        """generate_embedding raises ValueError for empty text."""
        service = _make_service()
        with pytest.raises(ValueError, match="text must not be empty"):
            await service.generate_embedding("")

    @pytest.mark.asyncio
    async def test_raises_vertex_ai_error_when_model_fails(self) -> None:
        """generate_embedding raises VertexAIServiceError when the model raises."""
        with patch("app.services.vertex_ai_service.TextEmbeddingModel") as mock_cls:
            mock_model = MagicMock()
            mock_model.get_embeddings.side_effect = RuntimeError("embedding error")
            mock_cls.from_pretrained.return_value = mock_model

            service = _make_service()
            with pytest.raises(VertexAIServiceError, match="embedding generation failed"):
                await service.generate_embedding("Some text")
