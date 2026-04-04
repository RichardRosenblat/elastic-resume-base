"""Custom exceptions for the AI Worker service."""

from __future__ import annotations


class VertexAIError(Exception):
    """Raised when a Vertex AI API call fails.

    Attributes:
        message: Human-readable description of the failure.
    """

    def __init__(self, message: str) -> None:
        """Initialise a VertexAIError.

        Args:
            message: Human-readable description of the failure.
        """
        super().__init__(message)
        self.message = message


class ExtractionError(VertexAIError):
    """Raised when structured field extraction from resume text fails."""


class EmbeddingError(VertexAIError):
    """Raised when embedding vector generation fails."""


class ResumeNotFoundError(Exception):
    """Raised when the requested resume document does not exist in Firestore.

    Attributes:
        resume_id: The Firestore document ID that was not found.
    """

    def __init__(self, resume_id: str) -> None:
        """Initialise a ResumeNotFoundError.

        Args:
            resume_id: The Firestore document ID that was not found.
        """
        super().__init__(f"Resume '{resume_id}' not found.")
        self.resume_id = resume_id


class PubSubMessageError(Exception):
    """Raised when a Pub/Sub push message cannot be decoded or is malformed.

    Attributes:
        message: Human-readable description of the failure.
    """

    def __init__(self, message: str) -> None:
        """Initialise a PubSubMessageError.

        Args:
            message: Human-readable description of the failure.
        """
        super().__init__(message)
        self.message = message
