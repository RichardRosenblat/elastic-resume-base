"""Interface and data model for the resume document store.

The ``resumes`` Firestore collection holds the core resume data written by the
Ingestor service (raw text) and enriched by the AI Worker (structured fields
and status).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable


@dataclass
class ResumeDocument:
    """A resume document as stored in the ``resumes`` Firestore collection.

    Attributes:
        resume_id: The Firestore document ID (also the resume's unique key).
        status: Lifecycle status string (``INGESTED``, ``PROCESSING``,
            ``PROCESSED``, ``FAILED``).
        raw_text: Raw resume text set by the Ingestor service.
        structured_data: Structured fields extracted by the AI Worker.
        error: Error message recorded when processing fails.
    """

    resume_id: str
    status: str
    raw_text: str | None = None
    structured_data: dict[str, Any] | None = None
    error: str | None = None


@runtime_checkable
class IResumeDocumentStore(Protocol):
    """Abstraction over the ``resumes`` Firestore collection.

    Consuming services depend on this protocol rather than any concrete
    implementation, so that the persistence backend can be swapped or mocked
    without changing business logic.

    Example:
        >>> class AIWorkerService:
        ...     def __init__(self, store: IResumeDocumentStore) -> None:
        ...         self._store = store
    """

    async def get_by_id(self, resume_id: str) -> ResumeDocument:
        """Retrieve a resume document by its unique identifier.

        Args:
            resume_id: The Firestore document ID.

        Returns:
            The hydrated :class:`ResumeDocument`.

        Raises:
            NotFoundError: If no document with the given ID exists.
        """
        ...

    async def update_status(self, resume_id: str, status: str) -> None:
        """Update the processing status field of a resume document.

        Args:
            resume_id: The Firestore document ID.
            status: The new status string.
        """
        ...

    async def save_structured_data(
        self, resume_id: str, structured_data: dict[str, Any]
    ) -> None:
        """Persist structured resume fields extracted by the AI Worker.

        Uses a merge write to preserve any fields not managed by the AI Worker.

        Args:
            resume_id: The Firestore document ID.
            structured_data: Dictionary of extracted resume fields.
        """
        ...

    async def save_error(self, resume_id: str, error_message: str) -> None:
        """Record a processing error on a resume document.

        Sets the status to ``FAILED`` and stores the error message.

        Args:
            resume_id: The Firestore document ID.
            error_message: A short description of the error.
        """
        ...
