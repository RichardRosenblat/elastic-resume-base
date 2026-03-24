"""FirestoreResumeStore — Firestore implementation of IResumeStore.

All Firestore access is encapsulated here.  Consuming services receive an
:class:`~synapse.interfaces.resume_store.IResumeStore` instance and are
completely decoupled from the underlying SDK.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class FirestoreResumeStore:
    """Concrete :class:`~synapse.interfaces.resume_store.IResumeStore` backed by Firestore.

    Receives an already-initialised Firestore ``Client`` (or ``AsyncClient``)
    from :func:`~synapse.persistence.initialize_persistence`.  The client is
    injected rather than created here so that the class remains unit-testable
    without any GCP credentials.

    Example:
        >>> from synapse import initialize_persistence, get_resume_store
        >>> initialize_persistence(project_id="my-project")
        >>> store = get_resume_store()
        >>> resume_id = store.create(text="Jane Doe, Software Engineer...")
    """

    def __init__(self, db: Any, collection: str = "resumes") -> None:
        """Initialise the store.

        Args:
            db: A ``google.cloud.firestore.Client`` instance or a compatible
                mock object.  When using a real client, call
                :func:`~synapse.persistence.initialize_persistence` once at
                startup — the client is then available via
                :func:`~synapse.persistence.get_db`.
            collection: Firestore collection name.  Defaults to ``"resumes"``.
        """
        self._db = db
        self._collection = collection

    def create(
        self,
        text: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Create a new resume document and return its generated ID.

        The document is written with:

        * ``text``: raw extracted text
        * ``status``: ``"INGESTED"``
        * ``metadata``: caller-supplied key/value pairs (or ``{}``)
        * ``createdAt``: UTC ISO-8601 timestamp

        Args:
            text: Raw extracted text from the resume file.
            metadata: Arbitrary metadata to store alongside the text.

        Returns:
            The Firestore-assigned document ID (used as ``resumeId``
            when publishing downstream events).

        Raises:
            google.api_core.exceptions.GoogleAPIError: If the Firestore write
                fails.
        """
        doc_ref = self._db.collection(self._collection).document()
        doc: dict[str, Any] = {
            "text": text,
            "status": "INGESTED",
            "metadata": metadata or {},
            "createdAt": datetime.now(tz=timezone.utc).isoformat(),
        }
        doc_ref.set(doc)
        resume_id: str = doc_ref.id
        logger.info(
            "Resume document created: id=%s collection=%s chars=%d.",
            resume_id,
            self._collection,
            len(text),
        )
        return resume_id
