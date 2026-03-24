"""Firestore repository for resume documents.

All Firestore interactions are encapsulated here.  Routers and services must
not access Firestore directly.
"""

from __future__ import annotations

import logging
from typing import Any

from google.api_core.exceptions import GoogleAPIError
from google.cloud import firestore  # type: ignore[attr-defined]

from app.models.resume import ResumeDocument, ResumeStatus, StructuredResumeFields

logger = logging.getLogger(__name__)


class ResumeNotFoundError(Exception):
    """Raised when a resume document cannot be found in Firestore."""


class ResumeRepository:
    """Data access layer for the ``resumes`` Firestore collection.

    Args:
        db: An async Firestore client instance.
        collection_name: The Firestore collection name (default: ``"resumes"``).

    Example:
        >>> db = firestore.AsyncClient(project="my-project")
        >>> repo = ResumeRepository(db)
        >>> resume = await repo.get_by_id("resume-abc123")
    """

    def __init__(self, db: firestore.AsyncClient, collection_name: str = "resumes") -> None:
        self._db = db
        self._collection_name = collection_name

    @property
    def _collection(self) -> firestore.AsyncCollectionReference:
        return self._db.collection(self._collection_name)

    async def get_by_id(self, resume_id: str) -> ResumeDocument:
        """Retrieve a resume document by its identifier.

        Args:
            resume_id: The Firestore document ID of the resume.

        Returns:
            The hydrated :class:`~app.models.resume.ResumeDocument`.

        Raises:
            ResumeNotFoundError: If no document with the given ID exists.
            GoogleAPIError: On Firestore communication errors.
        """
        logger.debug("Fetching resume document", extra={"resume_id": resume_id})
        try:
            doc_ref = self._collection.document(resume_id)
            snapshot = await doc_ref.get(timeout=30)
        except GoogleAPIError as exc:
            logger.error(
                "Firestore get failed for resume",
                extra={"resume_id": resume_id, "error": str(exc)},
            )
            raise

        if not snapshot.exists:
            raise ResumeNotFoundError(f"Resume {resume_id!r} not found in Firestore.")

        data: dict[str, Any] = snapshot.to_dict() or {}
        return ResumeDocument(
            resume_id=resume_id,
            status=ResumeStatus(data.get("status", ResumeStatus.INGESTED)),
            raw_text=data.get("rawText"),
            structured_data=StructuredResumeFields(**data["structuredData"])
            if data.get("structuredData")
            else None,
            embedding=data.get("embedding"),
            error=data.get("error"),
        )

    async def update_status(self, resume_id: str, status: ResumeStatus) -> None:
        """Update the processing status of a resume document.

        Args:
            resume_id: The Firestore document ID.
            status: The new :class:`~app.models.resume.ResumeStatus` value.

        Raises:
            GoogleAPIError: On Firestore communication errors.
        """
        logger.debug(
            "Updating resume status",
            extra={"resume_id": resume_id, "status": status.value},
        )
        try:
            await self._collection.document(resume_id).update(
                {"status": status.value},
                timeout=30,
            )
        except GoogleAPIError as exc:
            logger.error(
                "Firestore status update failed",
                extra={"resume_id": resume_id, "error": str(exc)},
            )
            raise

    async def save_processed_data(
        self,
        resume_id: str,
        structured_data: StructuredResumeFields,
        embedding: list[float],
    ) -> None:
        """Persist structured resume fields and embedding vector to Firestore.

        Uses a merge write so that existing fields not managed by the AI Worker
        are preserved.

        Args:
            resume_id: The Firestore document ID.
            structured_data: The Vertex AI-extracted structured fields.
            embedding: The embedding vector from Vertex AI.

        Raises:
            GoogleAPIError: On Firestore communication errors.
        """
        logger.debug(
            "Saving processed resume data",
            extra={"resume_id": resume_id},
        )
        payload: dict[str, Any] = {
            "status": ResumeStatus.PROCESSED.value,
            "structuredData": structured_data.model_dump(exclude_none=True),
            "embedding": embedding,
        }
        try:
            await self._collection.document(resume_id).set(payload, merge=True, timeout=30)
        except GoogleAPIError as exc:
            logger.error(
                "Firestore save_processed_data failed",
                extra={"resume_id": resume_id, "error": str(exc)},
            )
            raise

    async def save_error(self, resume_id: str, error_message: str) -> None:
        """Record a processing error on a resume document.

        Sets the status to ``FAILED`` and stores the error message.

        Args:
            resume_id: The Firestore document ID.
            error_message: A short description of the error.

        Raises:
            GoogleAPIError: On Firestore communication errors.
        """
        logger.debug(
            "Recording processing error on resume",
            extra={"resume_id": resume_id},
        )
        payload: dict[str, Any] = {
            "status": ResumeStatus.FAILED.value,
            "error": error_message,
        }
        try:
            await self._collection.document(resume_id).set(payload, merge=True, timeout=30)
        except GoogleAPIError as exc:
            logger.error(
                "Firestore save_error failed",
                extra={"resume_id": resume_id, "error": str(exc)},
            )
            raise
