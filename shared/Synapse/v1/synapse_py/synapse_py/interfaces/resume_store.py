"""Resume store interface for Synapse."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


class ResumeDocument:
    """A resume document record as stored in Firestore.

    Attributes:
        id: Auto-generated Firestore document ID.
        raw_text: The extracted plain text from the resume file.
        status: Processing status (e.g. ``"INGESTED"``, ``"PROCESSED"``).
        source: Metadata about the origin of the resume (e.g. sheet ID, row).
        metadata: Additional caller-supplied metadata.
        created_at: ISO-8601 UTC timestamp of document creation.
        updated_at: ISO-8601 UTC timestamp of last update.
    """

    __slots__ = ("id", "raw_text", "status", "source", "metadata", "created_at", "updated_at")

    def __init__(
        self,
        id: str,
        raw_text: str,
        status: str,
        source: dict[str, Any],
        metadata: dict[str, Any],
        created_at: str,
        updated_at: str,
    ) -> None:
        """Initialise a ResumeDocument.

        Args:
            id: Firestore document ID.
            raw_text: Extracted plain text.
            status: Processing status.
            source: Origin metadata.
            metadata: Additional metadata.
            created_at: Creation timestamp (ISO-8601 UTC).
            updated_at: Last-updated timestamp (ISO-8601 UTC).
        """
        self.id = id
        self.raw_text = raw_text
        self.status = status
        self.source = source
        self.metadata = metadata
        self.created_at = created_at
        self.updated_at = updated_at

    def to_dict(self) -> dict[str, Any]:
        """Return a plain-dict representation of this document.

        Returns:
            Dictionary mapping field names to their values.
        """
        return {
            "id": self.id,
            "rawText": self.raw_text,
            "status": self.status,
            "source": self.source,
            "metadata": self.metadata,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


class CreateResumeData:
    """Data required to create a new resume document.

    Attributes:
        raw_text: The extracted plain text from the resume file.
        source: Metadata about the origin of the resume.
        metadata: Additional caller-supplied metadata.
        content_hash: Optional SHA-256 hex digest of ``raw_text`` used for
            duplicate detection.  When provided, the value is stored in the
            Firestore document under the ``contentHash`` field.
    """

    __slots__ = ("raw_text", "source", "metadata", "content_hash")

    def __init__(
        self,
        raw_text: str,
        source: dict[str, Any],
        metadata: dict[str, Any] | None = None,
        content_hash: str | None = None,
    ) -> None:
        """Initialise CreateResumeData.

        Args:
            raw_text: Extracted plain text.
            source: Origin metadata.
            metadata: Additional metadata (optional).
            content_hash: SHA-256 hex digest of ``raw_text`` (optional).
        """
        self.raw_text = raw_text
        self.source = source
        self.metadata = metadata or {}
        self.content_hash = content_hash


class UpdateResumeData:
    """Data for updating an existing resume document.  All fields are optional.

    Attributes:
        raw_text: Updated plain text (optional).
        status: Updated processing status (optional).
        metadata: Updated metadata (optional).
    """

    __slots__ = ("raw_text", "status", "metadata")

    def __init__(
        self,
        raw_text: str | None = None,
        status: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Initialise UpdateResumeData.

        Args:
            raw_text: Updated plain text.
            status: Updated processing status.
            metadata: Updated metadata.
        """
        self.raw_text = raw_text
        self.status = status
        self.metadata = metadata


@runtime_checkable
class IResumeStore(Protocol):
    """Abstract interface for resume document persistence operations."""

    def create_resume(self, data: CreateResumeData) -> ResumeDocument:
        """Persist a new resume document and return the created record.

        Args:
            data: The resume data to persist.

        Returns:
            The newly created :class:`ResumeDocument` with the auto-generated ID.

        Raises:
            SynapseError: If the Firestore write fails.
        """
        ...

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
        ...

    def update_resume(self, resume_id: str, data: UpdateResumeData) -> ResumeDocument:
        """Update fields on an existing resume document.

        Args:
            resume_id: The Firestore document ID to update.
            data: Fields to update.

        Returns:
            The updated :class:`ResumeDocument`.

        Raises:
            SynapseNotFoundError: If no document with *resume_id* exists.
            SynapseError: If the Firestore write fails.
        """
        ...

    def find_by_content_hash(self, content_hash: str) -> ResumeDocument | None:
        """Find a resume document by its content hash.

        Args:
            content_hash: The SHA-256 hex digest to search for.

        Returns:
            The first matching :class:`ResumeDocument`, or ``None`` if no
            document with the given hash exists.

        Raises:
            SynapseError: If the Firestore query fails.
        """
        ...
