"""Interface and data model for the resume embedding store.

The ``resume_embeddings`` Firestore collection is kept **separate** from the
``resumes`` collection intentionally: embedding vectors are large binary
blobs consumed exclusively by the indexing pipeline and should not pollute the
core resume document.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass
class ResumeEmbeddingEntry:
    """An embedding entry stored in the ``resume_embeddings`` collection.

    Attributes:
        resume_id: Foreign key linking this entry to a document in ``resumes``.
        embedding: The dense float vector produced by the Vertex AI embedding
            model.
    """

    resume_id: str
    embedding: list[float]


@runtime_checkable
class IResumeEmbeddingStore(Protocol):
    """Abstraction over the ``resume_embeddings`` Firestore collection.

    Example:
        >>> class AIWorkerService:
        ...     def __init__(self, embedding_store: IResumeEmbeddingStore) -> None:
        ...         self._embedding_store = embedding_store
    """

    async def save_embedding(self, resume_id: str, embedding: list[float]) -> None:
        """Persist the embedding vector for a resume.

        Creates the document if it does not exist, or replaces the existing
        embedding if it does.

        Args:
            resume_id: The resume identifier (matches the ``resumes`` doc ID).
            embedding: The dense float vector to store.
        """
        ...

    async def get_by_resume_id(self, resume_id: str) -> ResumeEmbeddingEntry | None:
        """Retrieve the embedding entry for a resume.

        Args:
            resume_id: The resume identifier.

        Returns:
            The :class:`ResumeEmbeddingEntry` if found, ``None`` otherwise.
        """
        ...
