from enum import Enum

from pydantic import BaseModel


class DocumentType(str, Enum):
    """Enumeration of supported Brazilian document types."""

    RG = "RG"
    BIRTH_CERTIFICATE = "BIRTH_CERTIFICATE"
    MARRIAGE_CERTIFICATE = "MARRIAGE_CERTIFICATE"
    WORK_CARD = "WORK_CARD"
    PIS = "PIS"
    PROOF_OF_ADDRESS = "PROOF_OF_ADDRESS"
    PROOF_OF_EDUCATION = "PROOF_OF_EDUCATION"
    UNKNOWN = "UNKNOWN"


class ExtractedDocument(BaseModel):
    """Result of OCR and field extraction for a single document."""

    filename: str
    document_type: DocumentType
    raw_text: str | None
    extracted_fields: dict[str, str | None]


class OcrResponse(BaseModel):
    """Aggregated response for multiple processed documents."""

    documents: list[ExtractedDocument]
    total_documents: int
