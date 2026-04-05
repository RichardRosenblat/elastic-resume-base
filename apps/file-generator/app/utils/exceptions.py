"""Custom exceptions for the File Generator service."""

from __future__ import annotations


class FileGeneratorError(Exception):
    """Base class for all File Generator service errors.

    Attributes:
        message: Human-readable description of the failure.
    """

    def __init__(self, message: str) -> None:
        """Initialise a FileGeneratorError.

        Args:
            message: Human-readable description of the failure.
        """
        super().__init__(message)
        self.message = message


class ResumeNotFoundError(FileGeneratorError):
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


class TemplateNotFoundError(FileGeneratorError):
    """Raised when the ``.docx`` template file cannot be retrieved."""


class TemplateRenderError(FileGeneratorError):
    """Raised when Jinja2 template rendering fails."""


class TranslationError(FileGeneratorError):
    """Raised when the Google Cloud Translation API call fails."""


class KmsDecryptionError(FileGeneratorError):
    """Raised when Cloud KMS decryption of a PII field fails."""
