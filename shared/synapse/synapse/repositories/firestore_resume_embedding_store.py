"""Firestore-backed implementation of IResumeEmbeddingStore."""

from __future__ import annotations

import logging
from typing import Any

from google.api_core.exceptions import GoogleAPIError  # type: ignore[attr-defined]

from synapse.interfaces.resume_embedding_store import IResumeEmbeddingStore, ResumeEmbeddingEntry
from synapse.persistence import get_db

logger = logging.getLogger(__name__)

_DEFAULT_COLLECTION = "resume_embeddings"


class FirestoreResumeEmbeddingStore:
    """Concrete :class:`~synapse.interfaces.resume_embedding_store.IResumeEmbeddingStore`
    backed by Firestore.

    Embeddings are stored in a **separate** collection from resume documents so
    that large vectors do not inflate the core resume document reads.

    Args:
        collection_name: Name of the Firestore collection.
            Defaults to ``"resume_embeddings"``.

    Example:
        >>> from synapse.persistence import PersistenceOptions, initialize_persistence
        >>> from synapse.repositories import FirestoreResumeEmbeddingStore
        >>> initialize_persistence(PersistenceOptions(project_id="demo"))
        >>> store = FirestoreResumeEmbeddingStore()
        >>> await store.save_embedding("resume-abc", [0.1, 0.2, 0.3])
    """

    def __init__(self, collection_name: str = _DEFAULT_COLLECTION) -> None:
        self._collection_name = collection_name

    @property
    def _collection(self) -> Any:
        return get_db().collection(self._collection_name)

    async def save_embedding(self, resume_id: str, embedding: list[float]) -> None:
        """Persist (or replace) the embedding vector for a resume.

        The document ID in the ``resume_embeddings`` collection is the same as
        the resume's document ID in the ``resumes`` collection.

        Args:
            resume_id: The resume identifier.
            embedding: The dense float embedding vector.

        Raises:
            GoogleAPIError: Firestore communication failure.
        """
        logger.debug("Saving embedding", extra={"resume_id": resume_id})
        payload: dict[str, Any] = {"resumeId": resume_id, "embedding": embedding}
        try:
            await self._collection.document(resume_id).set(payload, timeout=30)
        except GoogleAPIError as exc:
            logger.error(
                "Firestore save_embedding failed",
                extra={"resume_id": resume_id, "error": str(exc)},
            )
            raise

    async def get_by_resume_id(self, resume_id: str) -> ResumeEmbeddingEntry | None:
        """Retrieve the embedding entry for a resume, or ``None`` if absent.

        Args:
            resume_id: The resume identifier.

        Returns:
            :class:`~synapse.interfaces.resume_embedding_store.ResumeEmbeddingEntry`
            if found, ``None`` otherwise.

        Raises:
            GoogleAPIError: Firestore communication failure.
        """
        logger.debug("Fetching embedding", extra={"resume_id": resume_id})
        try:
            snapshot = await self._collection.document(resume_id).get(timeout=30)
        except GoogleAPIError as exc:
            logger.error(
                "Firestore get_by_resume_id failed",
                extra={"resume_id": resume_id, "error": str(exc)},
            )
            raise

        if not snapshot.exists:
            return None

        data: dict[str, Any] = snapshot.to_dict() or {}
        return ResumeEmbeddingEntry(
            resume_id=resume_id,
            embedding=data.get("embedding", []),
        )
