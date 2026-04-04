"""Vertex AI service for resume text extraction and embedding generation.

Provides :class:`VertexAIService` which wraps two Vertex AI calls:

* **Structured extraction** — uses a Gemini generative model to parse raw
  resume text into a JSON object with standardised fields (name, email, skills,
  work experience, education, …).
* **Embedding generation** — uses a text embedding model to produce semantic
  vectors for the full resume text and for the extracted skills list.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.utils.exceptions import EmbeddingError, ExtractionError

logger = logging.getLogger(__name__)

_EXTRACTION_PROMPT_TEMPLATE = """You are a professional resume parser. Extract structured information from the following resume text and return ONLY a valid JSON object with no additional text or markdown.

The JSON object must have exactly this structure (use null for missing fields, empty arrays [] for missing lists):
{{
  "name": "Full name of the candidate",
  "email": "Email address",
  "phone": "Phone number",
  "address": "Full address",
  "summary": "Professional summary or objective statement",
  "skills": ["skill1", "skill2"],
  "workExperience": [
    {{
      "title": "Job title",
      "company": "Company name",
      "startDate": "Start date (e.g. 2020-01)",
      "endDate": "End date or null if current",
      "description": "Role description and achievements"
    }}
  ],
  "education": [
    {{
      "institution": "Institution name",
      "degree": "Degree type",
      "fieldOfStudy": "Field of study",
      "startDate": "Start date",
      "endDate": "End date"
    }}
  ],
  "languages": ["language1", "language2"],
  "certifications": ["certification1", "certification2"]
}}

Resume text:
{raw_text}

Return ONLY the JSON object, no markdown, no explanation."""


class VertexAIService:
    """Wrapper for Vertex AI generative and embedding model calls.

    Uses Application Default Credentials (ADC) for authentication.  Call
    :meth:`initialize` once at application startup before using any other
    method.

    Args:
        project_id: GCP project ID for Vertex AI API calls.
        location: GCP region (e.g. ``"us-central1"``).
        extraction_model: Gemini model ID for structured field extraction.
        embedding_model: Text embedding model ID for vector generation.

    Example::

        service = VertexAIService(
            project_id="my-project",
            location="us-central1",
            extraction_model="gemini-1.5-flash",
            embedding_model="text-multilingual-embedding-002",
        )
        service.initialize()
        fields = service.extract_structured_fields("John Doe, Software Engineer...")
        embeddings = service.generate_embeddings(["full text", "Python, Java"])
    """

    def __init__(
        self,
        project_id: str,
        location: str,
        extraction_model: str,
        embedding_model: str,
    ) -> None:
        """Initialise a VertexAIService.

        Args:
            project_id: GCP project ID.
            location: GCP region.
            extraction_model: Gemini model ID for extraction.
            embedding_model: Embedding model ID.
        """
        self._project_id = project_id
        self._location = location
        self._extraction_model_id = extraction_model
        self._embedding_model_id = embedding_model
        self._initialized = False

    def initialize(self) -> None:
        """Initialise the Vertex AI SDK.

        Must be called once before :meth:`extract_structured_fields` or
        :meth:`generate_embeddings`.  Subsequent calls are no-ops.

        Raises:
            ImportError: If ``google-cloud-aiplatform`` is not installed.
        """
        if self._initialized:
            return
        try:
            import vertexai  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "The 'google-cloud-aiplatform' package is required. "
                "Install it with: pip install google-cloud-aiplatform"
            ) from exc
        vertexai.init(project=self._project_id, location=self._location)
        self._initialized = True
        logger.debug(
            "Vertex AI SDK initialised",
            extra={"project_id": self._project_id, "location": self._location},
        )

    def extract_structured_fields(self, raw_text: str) -> dict[str, Any]:
        """Extract structured resume fields from raw text using Gemini.

        Args:
            raw_text: Plain text content of the resume.

        Returns:
            A dictionary with standardised resume fields (name, email, skills,
            workExperience, education, …).

        Raises:
            ExtractionError: If the Gemini call fails or the response cannot
                be parsed as JSON.
        """
        if not self._initialized:
            raise RuntimeError(
                "VertexAIService has not been initialised. "
                "Call initialize() before extract_structured_fields()."
            )
        try:
            from vertexai.generative_models import GenerativeModel  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "The 'google-cloud-aiplatform' package is required."
            ) from exc

        prompt = _EXTRACTION_PROMPT_TEMPLATE.format(raw_text=raw_text)
        try:
            model = GenerativeModel(self._extraction_model_id)
            response = model.generate_content(prompt)
            response_text = response.text.strip()
        except Exception as exc:
            logger.error("Vertex AI extraction call failed: %s", exc)
            raise ExtractionError(f"Gemini extraction failed: {exc}") from exc

        # Strip optional markdown code fences that the model may still include.
        if response_text.startswith("```"):
            lines = response_text.splitlines()
            # Remove opening fence (```json or ```) and closing fence (```)
            inner = [
                line for line in lines if not line.strip().startswith("```")
            ]
            response_text = "\n".join(inner).strip()

        try:
            result: dict[str, Any] = json.loads(response_text)
        except json.JSONDecodeError as exc:
            logger.error(
                "Failed to parse Gemini extraction response as JSON: %s",
                response_text[:200],
            )
            raise ExtractionError(
                f"Could not parse Gemini response as JSON: {exc}"
            ) from exc

        logger.debug(
            "Structured fields extracted",
            extra={"fields": list(result.keys())},
        )
        return result

    def generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate semantic embedding vectors for a list of text inputs.

        Args:
            texts: List of text strings to embed.  Each string produces one
                embedding vector.

        Returns:
            A list of embedding vectors (each is a list of floats) in the same
            order as the input ``texts``.

        Raises:
            EmbeddingError: If the Vertex AI embedding call fails.
        """
        if not self._initialized:
            raise RuntimeError(
                "VertexAIService has not been initialised. "
                "Call initialize() before generate_embeddings()."
            )
        if not texts:
            return []

        try:
            from vertexai.language_models import TextEmbeddingModel  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "The 'google-cloud-aiplatform' package is required."
            ) from exc

        try:
            model = TextEmbeddingModel.from_pretrained(self._embedding_model_id)
            embeddings = model.get_embeddings(texts)
            result = [emb.values for emb in embeddings]
        except Exception as exc:
            logger.error("Vertex AI embedding call failed: %s", exc)
            raise EmbeddingError(f"Embedding generation failed: {exc}") from exc

        logger.debug(
            "Embeddings generated",
            extra={"count": len(result), "dimensions": len(result[0]) if result else 0},
        )
        return result
