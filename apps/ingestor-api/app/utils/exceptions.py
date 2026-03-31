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
