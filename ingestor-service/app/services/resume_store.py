"""Firestore persistence for resume documents.

All Firestore access for the Ingestor Service is encapsulated here, providing
a clean boundary that is easy to mock in unit tests.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class ResumeStore:
    """Reads and writes resume documents in the Firestore ``resumes`` collection.

    Example:
        >>> from google.cloud import firestore
        >>> db = firestore.Client(project="my-project")
        >>> store = ResumeStore(db=db, collection="resumes")
        >>> resume_id = store.create(text="Resume text...", metadata={"source": "sheet-abc"})
    """

    def __init__(self, db: Any, collection: str = "resumes") -> None:
        """Initialise the store.

        Args:
            db: A ``google.cloud.firestore.Client`` instance or a compatible mock.
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
        * ``createdAt``: server timestamp

        Args:
            text: Raw extracted text from the resume file.
            metadata: Arbitrary metadata to store alongside the text
                (e.g. sheet row data, file names).

        Returns:
            The Firestore-assigned document ID (used as ``resumeId``).

        Raises:
            google.api_core.exceptions.GoogleAPIError: If the Firestore write fails.
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
            "Resume document created: id=%s, chars=%d.",
            resume_id,
            len(text),
        )
        return resume_id
