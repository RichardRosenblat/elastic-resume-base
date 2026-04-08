"""Custom exception classes for the ingestor service."""

from __future__ import annotations


class IngestorError(Exception):
    """Base exception for ingestor service errors."""


class TextExtractionError(IngestorError):
    """Raised when text extraction from a resume file fails."""


class UnsupportedFileTypeError(IngestorError):
    """Raised when an unsupported file type is encountered."""


class SheetReadError(IngestorError):
    """Raised when reading data from Google Sheets fails."""


class DriveDownloadError(IngestorError):
    """Raised when downloading a file from Google Drive fails."""


class DuplicateResumeError(IngestorError):
    """Raised when a resume with the same content hash already exists.

    Attributes:
        existing_resume_id: Firestore document ID of the already-ingested resume.
    """

    def __init__(self, existing_resume_id: str) -> None:
        """Initialise the error.

        Args:
            existing_resume_id: Firestore document ID of the duplicate resume.
        """
        super().__init__(
            f"Resume already ingested (existing document: {existing_resume_id!r})."
        )
        self.existing_resume_id = existing_resume_id
