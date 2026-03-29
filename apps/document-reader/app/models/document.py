from enum import Enum

from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    """Enumeration of supported Brazilian document types.

    Used to classify each uploaded document after OCR text extraction.
    Classification is keyword-based: the OCR text is scanned for
    characteristic phrases (e.g. *"REGISTRO GERAL"* for RG) and the first
    match in detection-priority order wins.
    """

    RG = "RG"
    """Registro Geral — Brazilian identity card.

    Extracted fields: ``rg_number``, ``name``.
    """

    BIRTH_CERTIFICATE = "BIRTH_CERTIFICATE"
    """Certidão de Nascimento — birth certificate.

    Extracted fields: ``name``, ``date_of_birth``.
    """

    MARRIAGE_CERTIFICATE = "MARRIAGE_CERTIFICATE"
    """Certidão de Casamento — marriage certificate.

    Extracted fields: ``name``, ``date_of_marriage``, ``spouse_name``.
    """

    WORK_CARD = "WORK_CARD"
    """Carteira de Trabalho e Previdência Social (CTPS) — work card.

    Extracted fields: ``issue_date``, ``work_card_number``.
    """

    PIS = "PIS"
    """PIS / PASEP / NIS — social integration programme number.

    Extracted fields: ``pis_number``.
    """

    PROOF_OF_ADDRESS = "PROOF_OF_ADDRESS"
    """Comprovante de Residência — proof of address (utility bill, etc.).

    Extracted fields: ``address`` (street + CEP when available).
    """

    PROOF_OF_EDUCATION = "PROOF_OF_EDUCATION"
    """Diploma / Histórico Escolar / Certificado de Conclusão — proof of education.

    Extracted fields: ``institution_name``, ``year_of_completion``.
    """

    UNKNOWN = "UNKNOWN"
    """Document could not be matched to any known type.

    No structured fields are extracted; ``extracted_fields`` will be an empty dict.
    """


class ExtractedDocument(BaseModel):
    """Result of OCR and field extraction for a single document.

    Each uploaded file produces one ``ExtractedDocument`` instance.  The
    ``extracted_fields`` mapping is keyed by field identifiers defined in
    ``app.document_schema`` and depends on the detected ``document_type``.
    """

    filename: str = Field(
        description="Original filename of the uploaded document as provided by the client.",
        examples=["rg_frente.jpg", "ctps.pdf"],
    )
    document_type: DocumentType = Field(
        description=(
            "Detected Brazilian document type.  ``UNKNOWN`` when the OCR text "
            "does not match any recognized document pattern."
        ),
        examples=["RG", "WORK_CARD"],
    )
    raw_text: str | None = Field(
        default=None,
        description=(
            "Full raw text extracted by OCR.  ``null`` when the OCR engine "
            "returned no text (e.g. blank page or unreadable scan)."
        ),
    )
    extracted_fields: dict[str, str | None] = Field(
        description=(
            "Key-value map of structured fields extracted from the document text. "
            "Keys and their presence depend on ``document_type``:\n\n"
            "| ``document_type`` | Fields |\n"
            "|---|---|\n"
            "| `RG` | `rg_number`, `name` |\n"
            "| `BIRTH_CERTIFICATE` | `name`, `date_of_birth` |\n"
            "| `MARRIAGE_CERTIFICATE` | `name`, `date_of_marriage`, `spouse_name` |\n"
            "| `WORK_CARD` | `issue_date`, `work_card_number` |\n"
            "| `PIS` | `pis_number` |\n"
            "| `PROOF_OF_ADDRESS` | `address` |\n"
            "| `PROOF_OF_EDUCATION` | `institution_name`, `year_of_completion` |\n"
            "| `UNKNOWN` | *(empty dict)* |\n\n"
            "Values are ``null`` when the regex pattern did not match."
        ),
        examples=[{"rg_number": "12.345.678-9", "name": "FULANO DE TAL"}],
    )


class OcrResponse(BaseModel):
    """Aggregated response for multiple processed documents."""

    documents: list[ExtractedDocument] = Field(
        description="List of extraction results, one per processed file (or ZIP entry).",
    )
    total_documents: int = Field(
        description="Total number of documents processed in this request.",
        examples=[3],
    )
