"""Resume domain models for the AI Worker service."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ResumeStatus(str, Enum):
    """Lifecycle status of a resume document in Firestore."""

    INGESTED = "INGESTED"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"


class StructuredResumeFields(BaseModel):
    """Structured fields extracted from raw resume text by Vertex AI.

    All fields are optional because the extraction model may not be able to
    identify every field in every resume.
    """

    name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    work_experience: list[dict[str, Any]] = Field(default_factory=list)
    education: list[dict[str, Any]] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class ResumeDocument(BaseModel):
    """Representation of a resume document as stored in Firestore.

    Only the fields consumed or written by the AI Worker are modelled here.
    """

    resume_id: str
    status: ResumeStatus
    raw_text: str | None = None
    structured_data: StructuredResumeFields | None = None
    embedding: list[float] | None = None
    error: str | None = None
