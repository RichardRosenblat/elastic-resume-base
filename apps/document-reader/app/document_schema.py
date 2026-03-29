"""Single table of truth for the document-reader service.

Every piece of domain data that governs **file handling** and **Excel output** is
defined here and imported by the rest of the application.  Nothing in this
module performs I/O; it is pure configuration.

To add a new document type:
1. Add an entry to :data:`DOCUMENT_SCHEMA`.
2. Add its key to :data:`DETECTION_PRIORITY` at the right precedence position.
3. Add the corresponding value to the ``DocumentType`` enum in
   ``app/models/document.py``.

To add a new extractable field to an existing type:
1. Append a :class:`FieldSpec` to the relevant ``DocumentSpec.fields`` tuple.
   The Excel service will automatically include the new column.

To change which file extensions the OCR pipeline accepts:
1. Update :data:`ALLOWED_FILE_EXTENSIONS`.
2. If the new extension requires image-based OCR, also add it to
   :data:`IMAGE_EXTENSIONS`.
"""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class FieldSpec:
    """Specification for a single extractable field within a document type.

    Attributes:
        key: Internal dictionary key used in ``ExtractedDocument.extracted_fields``.
        label: Excel column header.  ``None`` marks the field as *internal-only*
            (extracted for post-processing but not written to Excel).
        pattern: Raw regular-expression pattern string applied to the OCR text.
        flags: ``re`` module flags (e.g. ``re.IGNORECASE``).  Defaults to 0.
        group: Regex group index whose value is captured (0 = whole match,
            1+ = numbered capture group).  Defaults to 0.
    """

    key: str
    label: str | None
    pattern: str
    flags: int = 0
    group: int = 0


@dataclass(frozen=True)
class DocumentSpec:
    """Specification for a single document type.

    Attributes:
        keywords: Uppercase substrings used to classify OCR text.  The detector
            checks whether *any* keyword appears in the uppercased OCR text.
        fields: Ordered field definitions used for extraction and, when
            ``FieldSpec.label`` is not ``None``, for Excel column layout.
    """

    keywords: tuple[str, ...]
    fields: tuple[FieldSpec, ...]


# ---------------------------------------------------------------------------
# Shared pattern strings (reused across multiple document types)
# ---------------------------------------------------------------------------

_PAT_NAME = r"(?:NOME|Nome)\s*[:\-]?\s*([A-ZÀ-Ú][A-Za-zÀ-ú ]{2,})"
_PAT_DATE = r"\d{2}[/.\-]\d{2}[/.\-]\d{4}|\d{2} de \w+ de \d{4}"

# ---------------------------------------------------------------------------
# DOCUMENT_SCHEMA — single table of truth
# ---------------------------------------------------------------------------

#: Maps each document type (by its ``DocumentType`` string value) to its
#: detection keywords and field extraction specifications.
#:
#: This dict is the authoritative source for:
#:
#: * **Classification** — which keywords identify each document type.
#: * **Extraction** — which regex patterns extract which fields.
#: * **Excel layout** — the order of columns and the mapping of extracted
#:   fields to column headers (derived by :mod:`app.services.excel_service`).
DOCUMENT_SCHEMA: dict[str, DocumentSpec] = {
    "RG": DocumentSpec(
        keywords=(
            "REGISTRO GERAL",
            "IDENTIDADE",
            "CARTEIRA DE IDENTIDADE",
            "SECRETARIA DE SEGURANÇA",
        ),
        fields=(
            FieldSpec(
                key="rg_number",
                label="Número RG",
                pattern=r"\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]",
            ),
            FieldSpec(
                key="name",
                label="Nome",
                pattern=_PAT_NAME,
                flags=re.IGNORECASE,
                group=1,
            ),
        ),
    ),
    "BIRTH_CERTIFICATE": DocumentSpec(
        keywords=("CERTIDÃO DE NASCIMENTO", "NASCIMENTO"),
        fields=(
            FieldSpec(
                key="name",
                label="Nome",
                pattern=_PAT_NAME,
                flags=re.IGNORECASE,
                group=1,
            ),
            FieldSpec(
                key="date_of_birth",
                label="Data",
                pattern=_PAT_DATE,
                flags=re.IGNORECASE,
            ),
        ),
    ),
    "MARRIAGE_CERTIFICATE": DocumentSpec(
        keywords=("CERTIDÃO DE CASAMENTO", "CASAMENTO"),
        fields=(
            FieldSpec(
                key="name",
                label="Nome",
                pattern=_PAT_NAME,
                flags=re.IGNORECASE,
                group=1,
            ),
            FieldSpec(
                key="date_of_marriage",
                label="Data",
                pattern=_PAT_DATE,
                flags=re.IGNORECASE,
            ),
            FieldSpec(
                key="spouse_name",
                label="Cônjuge",
                pattern=(
                    r"(?:CÔNJUGE|ESPOSO|ESPOSA|CONTRATANTE|NOIVO|NOIVA)"
                    r"\s*[:\-]?\s*([A-ZÀ-Ú][A-Za-zÀ-ú ]{2,})"
                ),
                flags=re.IGNORECASE,
                group=1,
            ),
        ),
    ),
    "WORK_CARD": DocumentSpec(
        keywords=("CARTEIRA DE TRABALHO", "CTPS", "MINISTÉRIO DO TRABALHO"),
        fields=(
            FieldSpec(
                key="issue_date",
                label="Data Emissão CTPS",
                pattern=_PAT_DATE,
                flags=re.IGNORECASE,
            ),
            FieldSpec(
                key="work_card_number",
                label="Número CTPS",
                pattern=r"(?:N[°º]?\.?\s*(?:CTPS)?|CTPS\s*N[°º]?\.?)\s*(\d[\d.\-/]+)",
                flags=re.IGNORECASE,
                group=1,
            ),
        ),
    ),
    "PIS": DocumentSpec(
        keywords=("PIS", "PASEP", "NIS", "PROGRAMA DE INTEGRAÇÃO SOCIAL"),
        fields=(
            FieldSpec(
                key="pis_number",
                label="Número PIS",
                pattern=r"\d{3}\.?\d{5}\.?\d{2}-?\d",
            ),
        ),
    ),
    "PROOF_OF_ADDRESS": DocumentSpec(
        keywords=(
            "COMPROVANTE DE RESIDÊNCIA",
            "COMPROVANTE DE ENDEREÇO",
            "CONTA DE ÁGUA",
            "CONTA DE LUZ",
            "CONTA DE ENERGIA",
            "FATURA",
        ),
        fields=(
            FieldSpec(
                key="address",
                label="Endereço",
                pattern=(
                    r"(?:RUA|AV(?:ENIDA)?|TRAVESSA|ALAMEDA|ESTRADA|RODOVIA)"
                    r"[.,]?\s+[A-Za-zÀ-ú0-9\s,.\-º°]+"
                    r"(?:CEP\s*:?\s*\d{5}-?\d{3})?"
                ),
                flags=re.IGNORECASE,
            ),
            # Internal field: used to append the postal code to the street
            # address when the street pattern does not already include it.
            # Not emitted as an Excel column (label=None).
            FieldSpec(
                key="cep",
                label=None,
                pattern=r"\d{5}-?\d{3}",
            ),
        ),
    ),
    "PROOF_OF_EDUCATION": DocumentSpec(
        keywords=(
            "DIPLOMA",
            "CERTIFICADO DE CONCLUSÃO",
            "HISTÓRICO ESCOLAR",
            "UNIVERSIDADE",
            "FACULDADE",
            "INSTITUIÇÃO DE ENSINO",
        ),
        fields=(
            FieldSpec(
                key="institution_name",
                label="Instituição de Ensino",
                pattern=(
                    r"(?:UNIVERSIDADE|FACULDADE|INSTITUTO"
                    r"|CENTRO UNIVERSITÁRIO|ESCOLA)\s+[A-ZÀ-Ú][A-Za-zÀ-ú ]+"
                ),
                flags=re.IGNORECASE,
            ),
            FieldSpec(
                key="year_of_completion",
                label="Ano de Conclusão",
                pattern=r"\b(19|20)\d{2}\b",
            ),
        ),
    ),
}

# ---------------------------------------------------------------------------
# Detection priority
# ---------------------------------------------------------------------------

#: Order in which document types are evaluated during text classification.
#: A type listed earlier wins when multiple types' keywords appear in the same
#: OCR text.  Must contain exactly the same keys as :data:`DOCUMENT_SCHEMA`.
DETECTION_PRIORITY: tuple[str, ...] = (
    "RG",
    "MARRIAGE_CERTIFICATE",
    "BIRTH_CERTIFICATE",
    "WORK_CARD",
    "PIS",
    "PROOF_OF_ADDRESS",
    "PROOF_OF_EDUCATION",
)

# ---------------------------------------------------------------------------
# Accepted file extensions
# ---------------------------------------------------------------------------

#: File extensions that the OCR pipeline can process directly.
#: Referenced by the router (upload validation) and the ZIP service (entry
#: filtering).
ALLOWED_FILE_EXTENSIONS: frozenset[str] = frozenset(
    {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp", ".docx"}
)

#: Subset of :data:`ALLOWED_FILE_EXTENSIONS` that are raster images handled by
#: the Google Cloud Vision API image path (as opposed to PDF or DOCX pipelines).
IMAGE_EXTENSIONS: frozenset[str] = frozenset(
    {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp"}
)

# ---------------------------------------------------------------------------
# MIME type → extension mapping
# ---------------------------------------------------------------------------

#: Maps well-known MIME type strings to their canonical file extension
#: (lowercase, including the leading dot).  Used by the upload router to resolve
#: a file's format from the ``Content-Type`` header of a multipart part, before
#: falling back to the filename extension.  Not exposed as a public API field —
#: the router uses this mapping internally when determining how to process a file
#: (e.g. which OCR path to take: PDF, DOCX, or raster image).
MIME_TYPE_TO_EXTENSION: dict[str, str] = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/tiff": ".tiff",
    "image/bmp": ".bmp",
    "image/webp": ".webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/zip": ".zip",
    "application/x-zip-compressed": ".zip",
    "application/x-zip": ".zip",
    "multipart/x-zip": ".zip",
}
