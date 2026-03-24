"""Vertex AI service — structured extraction and embedding generation.

This module wraps the Vertex AI SDK calls so that they can be easily mocked
in unit tests and swapped for alternative implementations in the future.

A sliding-window rate limiter enforces the ``VERTEX_AI_MAX_CALLS_PER_MINUTE``
setting loaded from ``config.yaml`` so the service never exceeds its quota.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import vertexai  # type: ignore[import-untyped]
from vertexai.generative_models import GenerativeModel  # type: ignore[import-untyped]
from vertexai.language_models import TextEmbeddingModel  # type: ignore[import-untyped]

from app.models.resume import StructuredResumeFields

logger = logging.getLogger(__name__)

_EXTRACTION_PROMPT_TEMPLATE = """
You are a precise resume parser.  Given the raw resume text below, extract the
following fields and return a valid JSON object — nothing else.

Required JSON structure:
{{
  "name": string | null,
  "email": string | null,
  "phone": string | null,
  "location": string | null,
  "summary": string | null,
  "skills": [string, ...],
  "languages": [string, ...],
  "work_experience": [
    {{
      "company": string,
      "title": string,
      "start_date": string | null,
      "end_date": string | null,
      "description": string | null
    }},
    ...
  ],
  "education": [
    {{
      "institution": string,
      "degree": string | null,
      "field": string | null,
      "graduation_year": string | null
    }},
    ...
  ],
  "certifications": [string, ...]
}}

Resume text:
---
{raw_text}
---

Return only the JSON object, with no additional explanation or markdown fencing.
"""


class VertexAIServiceError(Exception):
    """Raised when a Vertex AI API call fails."""


class VertexAIService:
    """Thin wrapper around the Vertex AI SDK for resume processing.

    Args:
        project_id: GCP project identifier.
        location: GCP region for Vertex AI (e.g. ``"us-central1"``).
        extraction_model: Generative model name for field extraction.
        embedding_model: Embedding model name.
        max_calls_per_minute: Maximum total Vertex AI API calls per minute
            (shared across extraction and embedding calls).  Defaults to
            ``60``.  Set via ``VERTEX_AI_MAX_CALLS_PER_MINUTE`` in
            ``config.yaml``.

    Example:
        >>> service = VertexAIService(
        ...     project_id="my-project",
        ...     location="us-central1",
        ...     max_calls_per_minute=30,
        ... )
        >>> fields = await service.extract_fields("John Doe — Software Engineer...")
        >>> embedding = await service.generate_embedding("John Doe — Software Engineer...")
    """

    def __init__(
        self,
        project_id: str,
        location: str = "us-central1",
        extraction_model: str = "gemini-1.5-flash",
        embedding_model: str = "text-multilingual-embedding-002",
        max_calls_per_minute: int = 60,
    ) -> None:
        vertexai.init(project=project_id, location=location)
        self._extraction_model_name = extraction_model
        self._embedding_model_name = embedding_model
        self._max_calls_per_minute = max_calls_per_minute
        self._call_count: int = 0
        self._window_start: float = time.monotonic()
        self._rate_lock = asyncio.Lock()

    async def _check_rate_limit(self) -> None:
        """Enforce the per-minute Vertex AI call rate limit.

        Uses a fixed sliding window (60 s).  Raises :class:`RateLimitError`
        when the window is exhausted so callers can surface it as a 429
        response and let Pub/Sub retry.

        Raises:
            RateLimitError: When the call budget for the current window is
                exceeded.
        """
        from toolbox.errors import RateLimitError  # local import avoids circular deps

        async with self._rate_lock:
            now = time.monotonic()
            if now - self._window_start >= 60.0:
                self._call_count = 0
                self._window_start = now
            if self._call_count >= self._max_calls_per_minute:
                raise RateLimitError(
                    f"Vertex AI rate limit of {self._max_calls_per_minute} calls/min exceeded. "
                    "The message will be retried."
                )
            self._call_count += 1

    async def extract_fields(self, raw_text: str) -> StructuredResumeFields:
        """Extract structured resume fields from raw text using Vertex AI.

        Args:
            raw_text: The raw resume text to process.

        Returns:
            A :class:`~app.models.resume.StructuredResumeFields` populated with
            whatever fields the model was able to identify.

        Raises:
            ValueError: If ``raw_text`` is empty.
            RateLimitError: If the per-minute call budget is exhausted.
            VertexAIServiceError: If the model call fails or returns invalid JSON.
        """
        if not raw_text or not raw_text.strip():
            raise ValueError("raw_text must not be empty.")

        await self._check_rate_limit()

        prompt = _EXTRACTION_PROMPT_TEMPLATE.format(raw_text=raw_text)
        logger.info("Calling Vertex AI for structured field extraction.")
        try:
            model = GenerativeModel(self._extraction_model_name)
            response = model.generate_content(prompt)
            response_text: str = response.text.strip()
        except Exception as exc:
            logger.error("Vertex AI extraction call failed: %s", exc)
            raise VertexAIServiceError(
                f"Vertex AI extraction failed: {exc}"
            ) from exc

        # Strip optional markdown code fence if the model returns one.
        if response_text.startswith("```"):
            lines = response_text.splitlines()
            response_text = "\n".join(
                line for line in lines if not line.startswith("```")
            ).strip()

        try:
            extracted: dict[str, Any] = json.loads(response_text)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse Vertex AI JSON response: %s", response_text)
            raise VertexAIServiceError(
                f"Vertex AI returned non-JSON response: {exc}"
            ) from exc

        return StructuredResumeFields(**extracted)

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate a semantic embedding vector for the given text.

        Args:
            text: The text to embed.

        Returns:
            A list of floats representing the embedding vector.

        Raises:
            ValueError: If ``text`` is empty.
            RateLimitError: If the per-minute call budget is exhausted.
            VertexAIServiceError: If the embedding model call fails.
        """
        if not text or not text.strip():
            raise ValueError("text must not be empty.")

        await self._check_rate_limit()

        logger.info("Calling Vertex AI for embedding generation.")
        try:
            model = TextEmbeddingModel.from_pretrained(self._embedding_model_name)
            embeddings = model.get_embeddings([text])
            return embeddings[0].values  # type: ignore[no-any-return]
        except Exception as exc:
            logger.error("Vertex AI embedding call failed: %s", exc)
            raise VertexAIServiceError(
                f"Vertex AI embedding generation failed: {exc}"
            ) from exc
