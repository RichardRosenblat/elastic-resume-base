"""Text extraction utilities for resume files.

Supports PDF (via PyMuPDF / fitz) and DOCX (via python-docx) formats.
These are the most common formats for digital resumes.
"""

from __future__ import annotations

import io

from toolbox_py import get_logger

from app.utils.exceptions import TextExtractionError, UnsupportedFileTypeError

logger = get_logger(__name__)

#: File extensions supported for direct text extraction (no OCR required).
SUPPORTED_EXTENSIONS: frozenset[str] = frozenset({".pdf", ".docx"})


def extract_text(content: bytes, extension: str) -> str:
    """Extract plain text from resume file bytes.

    Supports PDF and DOCX formats.  The extracted text is returned as a single
    string with newlines separating sections.

    Args:
        content: Raw file bytes.
        extension: File extension including the leading dot (e.g. ``".pdf"``).
            Case-insensitive.

    Returns:
        Extracted plain text.  May be an empty string if the file contains no
        extractable text.

    Raises:
        UnsupportedFileTypeError: If *extension* is not in
            :data:`SUPPORTED_EXTENSIONS`.
        TextExtractionError: If text extraction fails for the given file.
    """
    ext = extension.lower()
    logger.debug(
        "Starting text extraction",
        extra={"extension": ext, "content_size_bytes": len(content)},
    )

    if ext == ".pdf":
        text = _extract_pdf(content)
    elif ext == ".docx":
        text = _extract_docx(content)
    else:
        raise UnsupportedFileTypeError(
            f"Unsupported file extension: {extension!r}. "
            f"Supported extensions: {sorted(SUPPORTED_EXTENSIONS)}"
        )

    logger.debug(
        "Text extraction complete",
        extra={"extension": ext, "extracted_chars": len(text)},
    )
    return text


def _extract_pdf(content: bytes) -> str:
    """Extract text from a PDF file using PyMuPDF.

    Args:
        content: Raw PDF bytes.

    Returns:
        Concatenated text from all pages.

    Raises:
        TextExtractionError: If PDF processing fails.
    """
    try:
        import fitz  # type: ignore[import-untyped]  # pymupdf

        doc = fitz.open(stream=content, filetype="pdf")
        page_count: int = int(doc.page_count)
        logger.debug("Processing PDF", extra={"page_count": page_count})

        texts: list[str] = []
        for page_index in range(page_count):
            page = doc[page_index]
            page_text: str = page.get_text()  # type: ignore[union-attr]
            if page_text.strip():
                texts.append(page_text.strip())

        doc.close()
        logger.debug(
            "PDF processing complete",
            extra={"pages_with_text": len(texts), "total_pages": page_count},
        )
        return "\n\n".join(texts)
    except Exception as exc:
        logger.error("PDF text extraction failed: %s", exc)
        raise TextExtractionError(f"Failed to extract text from PDF: {exc}") from exc


def _extract_docx(content: bytes) -> str:
    """Extract text from a DOCX file using python-docx.

    Collects text from paragraphs and table cells.

    Args:
        content: Raw DOCX bytes.

    Returns:
        Extracted text with paragraphs and table cells joined by newlines.

    Raises:
        TextExtractionError: If DOCX processing fails.
    """
    try:
        import docx  # type: ignore[import-untyped]

        logger.debug("Processing DOCX", extra={"content_size_bytes": len(content)})
        document = docx.Document(io.BytesIO(content))
        texts: list[str] = []

        # Paragraph text
        for para in document.paragraphs:
            if para.text.strip():
                texts.append(para.text.strip())

        # Table cell text — deduplicate merged cells by XML element identity
        seen_tcs: set[object] = set()
        for table in document.tables:
            for row in table.rows:
                for cell in row.cells:
                    tc = cell._tc  # type: ignore[attr-defined]
                    if tc in seen_tcs:
                        continue
                    seen_tcs.add(tc)
                    if cell.text.strip():
                        texts.append(cell.text.strip())

        logger.debug(
            "DOCX processing complete",
            extra={"text_block_count": len(texts)},
        )
        return "\n".join(texts)
    except Exception as exc:
        logger.error("DOCX text extraction failed: %s", exc)
        raise TextExtractionError(f"Failed to extract text from DOCX: {exc}") from exc
