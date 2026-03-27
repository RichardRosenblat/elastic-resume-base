class DocumentReaderError(Exception):
    """Base exception for document reader errors."""


class OcrServiceError(DocumentReaderError):
    """Raised when OCR processing fails."""


class UnsupportedFileTypeError(DocumentReaderError):
    """Raised when an unsupported file type is provided."""


class ExcelGenerationError(DocumentReaderError):
    """Raised when Excel file generation fails."""


class ZipExtractionError(DocumentReaderError):
    """Raised when ZIP archive extraction fails."""
