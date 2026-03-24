"""Firestore-backed implementation of IResumeDocumentStore."""

from __future__ import annotations

import logging
from typing import Any

from google.api_core.exceptions import GoogleAPIError  # type: ignore[attr-defined]

from synapse.errors import NotFoundError
from synapse.interfaces.resume_document_store import IResumeDocumentStore, ResumeDocument
from synapse.persistence import get_db

logger = logging.getLogger(__name__)

_DEFAULT_COLLECTION = "resumes"


class FirestoreResumeDocumentStore:
    """Concrete :class:`~synapse.interfaces.resume_document_store.IResumeDocumentStore`
    backed by Firestore.

    Args:
        collection_name: Name of the Firestore collection.
            Defaults to ``"resumes"``.

    Example:
        >>> from synapse.persistence import PersistenceOptions, initialize_persistence
        >>> from synapse.repositories import FirestoreResumeDocumentStore
        >>> initialize_persistence(PersistenceOptions(project_id="demo"))
        >>> store = FirestoreResumeDocumentStore()
        >>> resume = await store.get_by_id("resume-abc123")
    """

    def __init__(self, collection_name: str = _DEFAULT_COLLECTION) -> None:
        self._collection_name = collection_name

    @property
    def _collection(self) -> Any:
        return get_db().collection(self._collection_name)

    async def get_by_id(self, resume_id: str) -> ResumeDocument:
        """Retrieve a resume document by ID.

        Args:
            resume_id: Firestore document ID.

        Returns:
            Hydrated :class:`~synapse.interfaces.resume_document_store.ResumeDocument`.

        Raises:
            NotFoundError: Document does not exist.
            GoogleAPIError: Firestore communication failure.
        """
        logger.debug("Fetching resume document", extra={"resume_id": resume_id})
        try:
            snapshot = await self._collection.document(resume_id).get(timeout=30)
        except GoogleAPIError as exc:
            logger.error(
                "Firestore get failed", extra={"resume_id": resume_id, "error": str(exc)}
            )
            raise

        if not snapshot.exists:
            raise NotFoundError(f"Resume '{resume_id}' not found in Firestore.")

        data: dict[str, Any] = snapshot.to_dict() or {}
        return ResumeDocument(
            resume_id=resume_id,
            status=data.get("status", "INGESTED"),
            raw_text=data.get("rawText"),
            structured_data=data.get("structuredData"),
            error=data.get("error"),
        )

    async def update_status(self, resume_id: str, status: str) -> None:
        """Update the status field of a resume document.

        Args:
            resume_id: Firestore document ID.
            status: New status string.

        Raises:
            GoogleAPIError: Firestore communication failure.
        """
        logger.debug(
            "Updating resume status",
            extra={"resume_id": resume_id, "status": status},
        )
        try:
            await self._collection.document(resume_id).update(
                {"status": status}, timeout=30
            )
        except GoogleAPIError as exc:
            logger.error(
                "Firestore status update failed",
                extra={"resume_id": resume_id, "error": str(exc)},
            )
            raise

    async def save_structured_data(
        self, resume_id: str, structured_data: dict[str, Any]
    ) -> None:
        """Persist extracted structured fields using a merge write.

        Args:
            resume_id: Firestore document ID.
            structured_data: Dictionary of extracted resume fields.

        Raises:
            GoogleAPIError: Firestore communication failure.
        """
        logger.debug(
            "Saving structured resume data", extra={"resume_id": resume_id}
        )
        payload: dict[str, Any] = {"structuredData": structured_data}
        try:
            await self._collection.document(resume_id).set(
                payload, merge=True, timeout=30
            )
        except GoogleAPIError as exc:
            logger.error(
                "Firestore save_structured_data failed",
                extra={"resume_id": resume_id, "error": str(exc)},
            )
            raise

    async def save_error(self, resume_id: str, error_message: str) -> None:
        """Record a processing failure on a resume document.

        Sets status to ``FAILED`` and stores the error message.

        Args:
            resume_id: Firestore document ID.
            error_message: Short description of the error.

        Raises:
            GoogleAPIError: Firestore communication failure.
        """
        logger.debug(
            "Recording processing error", extra={"resume_id": resume_id}
        )
        payload: dict[str, Any] = {"status": "FAILED", "error": error_message}
        try:
            await self._collection.document(resume_id).set(
                payload, merge=True, timeout=30
            )
        except GoogleAPIError as exc:
            logger.error(
                "Firestore save_error failed",
                extra={"resume_id": resume_id, "error": str(exc)},
            )
            raise
