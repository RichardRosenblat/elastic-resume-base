"""IResumeStore — abstract interface for resume document persistence.

Consuming services depend on this protocol, never on the concrete
:class:`~synapse.repositories.firestore_resume_store.FirestoreResumeStore`.
This makes it easy to inject a mock in tests without any real Firestore calls.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class IResumeStore(Protocol):
    """Abstract read/write interface for the ``resumes`` Firestore collection.

    All Firestore interactions for resume documents go through this interface.
    Consuming services must never reference ``google-cloud-firestore`` directly.

    Example:
        >>> # In tests, substitute a mock:
        >>> class MockResumeStore:
        ...     def create(self, text: str, metadata=None) -> str:
        ...         return "mock-resume-id"
    """

    def create(
        self,
        text: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Create a new resume document and return its generated ID.

        Args:
            text: Raw extracted text from the resume file.
            metadata: Arbitrary metadata to store alongside the text
                (e.g. sheet row data, file names, campaign names).

        Returns:
            The persistence-layer-assigned document ID (used as ``resumeId``
            when publishing events downstream).

        Raises:
            Exception: If the underlying persistence layer rejects the write.
        """
        ...
