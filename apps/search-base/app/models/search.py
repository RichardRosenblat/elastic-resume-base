"""Pydantic models for search requests and responses."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SearchQuery(BaseModel):
    """Natural language search query.

    Attributes:
        q: The query string (natural language text).
        limit: Maximum number of results to return (default 10, max 100).
    """

    q: str = Field(description="Natural language search query")
    limit: int = Field(default=10, ge=1, le=100, description="Maximum results to return")


class SearchResultItem(BaseModel):
    """A single search result item.

    Attributes:
        resume_id: Unique identifier for the resume.
        score: Similarity score (higher is more similar, normalized 0-1 for cosine).
        metadata: Structured resume data (may include decrypted PII fields).
    """

    resume_id: str = Field(alias="resumeId")
    score: float
    metadata: dict


class SearchResponse(BaseModel):
    """Search results response.

    Attributes:
        query: The original query string.
        results: List of matching resumes, ranked by similarity.
        total: Total number of results returned.
    """

    query: str
    results: list[SearchResultItem]
    total: int
