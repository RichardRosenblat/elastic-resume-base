"""Firestore-backed implementation of the Synapse resume store."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from synapse_py.errors import SynapseError, SynapseNotFoundError
from synapse_py.interfaces.resume_store import (
    CreateResumeData,
    IResumeStore,
    ResumeDocument,
    UpdateResumeData,
)

logger = logging.getLogger(__name__)

_RESUMES_COLLECTION = "resumes"
_STATUS_INGESTED = "INGESTED"


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return (
        datetime.now(tz=UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _map_doc(doc_id: str, data: dict[str, Any]) -> ResumeDocument:
    """Map a Firestore document snapshot to a :class:`ResumeDocument`.

    Args:
        doc_id: The Firestore document ID.
        data: The raw document data dictionary.

    Returns:
        A :class:`ResumeDocument` instance.
    """
    return ResumeDocument(
        id=doc_id,
        raw_text=str(data.get("rawText", "")),
        status=str(data.get("status", _STATUS_INGESTED)),
        source=dict(data.get("source", {})),  # type: ignore[arg-type]
        metadata=dict(data.get("metadata", {})),  # type: ignore[arg-type]
        created_at=str(data.get("createdAt", "")),
        updated_at=str(data.get("updatedAt", "")),
    )


class FirestoreResumeStore(IResumeStore):
    """Concrete :class:`~synapse_py.interfaces.resume_store.IResumeStore` backed by Firestore.

    Writes to the ``resumes`` collection.  Requires
    :func:`~synapse_py.persistence.initialize_persistence` to have been called
    before any method is invoked.

    Example::

        from synapse_py import initialize_persistence, FirestoreResumeStore
        from synapse_py.interfaces.resume_store import CreateResumeData

        initialize_persistence(project_id="my-project")

        store = FirestoreResumeStore()
        resume = store.create_resume(
            CreateResumeData(
                raw_text="John Doe resume text...",
                source={"sheetId": "abc123", "row": 2},
            )
        )
        print(resume.id)
    """

    def __init__(self, collection_name: str = _RESUMES_COLLECTION) -> None:
        """Initialise the store.

        Args:
            collection_name: Firestore collection name.  Defaults to
                ``"resumes"``.
        """
        self._collection_name = collection_name

    @property
    def _collection(self) -> Any:
        """Return the Firestore collection reference.

        Returns:
            A Firestore ``CollectionReference``.

        Raises:
            ImportError: If ``firebase-admin`` is not installed.
            RuntimeError: If Firestore has not been initialised.
        """
        try:
            from firebase_admin import firestore  # type: ignore[import-untyped]
        except ImportError as exc:
            raise ImportError(
                "The 'firebase-admin' package is required for FirestoreResumeStore. "
                "Install it with: pip install 'elastic-resume-base-synapse[firestore]'"
            ) from exc
        return firestore.client().collection(self._collection_name)

    def create_resume(self, data: CreateResumeData) -> ResumeDocument:
        """Create a new resume document in Firestore and return it.

        A new document reference is created with an auto-generated ID.  The
        document is written with ``status="INGESTED"`` and timestamps for
        ``createdAt`` and ``updatedAt``.

        Args:
            data: The resume data to persist.

        Returns:
            The created :class:`ResumeDocument` with its auto-generated ID.

        Raises:
            SynapseError: If the Firestore write fails.
        """
        now = _now_iso()
        payload: dict[str, Any] = {
            "rawText": data.raw_text,
            "status": _STATUS_INGESTED,
            "source": data.source,
            "metadata": data.metadata,
            "createdAt": now,
            "updatedAt": now,
        }
        try:
            doc_ref = self._collection.document()
            doc_ref.set(payload)
        except Exception as exc:
            logger.error("Firestore create_resume failed: %s", exc)
            raise SynapseError(f"Failed to create resume document: {exc}") from exc

        logger.debug("Resume document created", extra={"resume_id": doc_ref.id})
        return _map_doc(doc_ref.id, payload)

    def get_resume(self, resume_id: str) -> ResumeDocument:
        """Retrieve a resume document by its Firestore ID.

        Args:
            resume_id: The Firestore document ID.

        Returns:
            The matching :class:`ResumeDocument`.

        Raises:
            SynapseNotFoundError: If no document with *resume_id* exists.
            SynapseError: If the Firestore read fails.
        """
        try:
            snap = self._collection.document(resume_id).get()
        except Exception as exc:
            logger.error("Firestore get_resume failed: %s", exc)
            raise SynapseError(f"Failed to retrieve resume document: {exc}") from exc

        if not snap.exists:
            raise SynapseNotFoundError(f"Resume '{resume_id}' not found.")
        return _map_doc(snap.id, snap.to_dict() or {})

    def update_resume(self, resume_id: str, data: UpdateResumeData) -> ResumeDocument:
        """Update fields on an existing resume document.

        Args:
            resume_id: The Firestore document ID to update.
            data: Fields to update.  Only non-``None`` fields are written.

        Returns:
            The updated :class:`ResumeDocument`.

        Raises:
            SynapseNotFoundError: If no document with *resume_id* exists.
            SynapseError: If the Firestore write fails.
        """
        doc_ref = self._collection.document(resume_id)
        try:
            snap = doc_ref.get()
        except Exception as exc:
            logger.error("Firestore update_resume fetch failed: %s", exc)
            raise SynapseError(f"Failed to fetch resume for update: {exc}") from exc

        if not snap.exists:
            raise SynapseNotFoundError(f"Resume '{resume_id}' not found.")

        updates: dict[str, Any] = {"updatedAt": _now_iso()}
        if data.raw_text is not None:
            updates["rawText"] = data.raw_text
        if data.status is not None:
            updates["status"] = data.status
        if data.metadata is not None:
            updates["metadata"] = data.metadata

        try:
            doc_ref.update(updates)
            updated_snap = doc_ref.get()
        except Exception as exc:
            logger.error("Firestore update_resume write failed: %s", exc)
            raise SynapseError(f"Failed to update resume document: {exc}") from exc

        return _map_doc(updated_snap.id, updated_snap.to_dict() or {})
