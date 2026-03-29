import re

from toolbox_py import get_logger

from app.document_schema import DETECTION_PRIORITY, DOCUMENT_SCHEMA
from app.models.document import DocumentType, ExtractedDocument

logger = get_logger(__name__)


class ExtractorService:
    """Service for detecting document type and extracting structured fields."""

    def detect_document_type(self, text: str) -> DocumentType:
        """Detect the Brazilian document type from OCR text using keyword matching.

        Uses :data:`~app.document_schema.DETECTION_PRIORITY` to determine precedence
        when multiple document types' keywords appear in the text.

        Args:
            text: Raw OCR text from the document.

        Returns:
            The detected :class:`~app.models.document.DocumentType`.
        """
        upper = text.upper()
        for doc_type_key in DETECTION_PRIORITY:
            spec = DOCUMENT_SCHEMA[doc_type_key]
            if any(kw in upper for kw in spec.keywords):
                logger.debug(
                    "Document type detected",
                    extra={"doc_type": doc_type_key},
                )
                return DocumentType(doc_type_key)
        logger.debug("Document type could not be determined; classified as UNKNOWN")
        return DocumentType.UNKNOWN

    def extract(
        self,
        filename: str,
        raw_text: str,
        forced_type: DocumentType | None = None,
    ) -> ExtractedDocument:
        """Detect (or use a provided) document type and extract structured fields.

        When *forced_type* is supplied the keyword-based detection step is
        skipped and the provided type is used directly.  This allows callers to
        bypass the automatic classifier when the document type is already known
        (e.g. explicitly selected by the user in the upload UI).

        Args:
            filename: Original filename of the uploaded document.
            raw_text: Raw OCR text.
            forced_type: If not ``None``, use this document type instead of
                running keyword-based detection.  Any valid
                :class:`~app.models.document.DocumentType` value is accepted,
                including ``UNKNOWN`` (which skips field extraction).

        Returns:
            :class:`~app.models.document.ExtractedDocument` with the resolved
            type and extracted fields.
        """
        logger.debug("Extracting fields from document", extra={"doc_filename": filename})
        if forced_type is not None:
            logger.debug(
                "Using caller-supplied document type (skipping detection)",
                extra={"doc_filename": filename, "forced_type": forced_type.value},
            )
            doc_type = forced_type
        else:
            doc_type = self.detect_document_type(raw_text)
        fields = self._extract_fields(doc_type, raw_text)
        populated = sum(1 for v in fields.values() if v is not None)
        logger.debug(
            "Field extraction complete",
            extra={
                "doc_filename": filename,
                "doc_type": doc_type.value,
                "fields_total": len(fields),
                "fields_populated": populated,
            },
        )
        return ExtractedDocument(
            filename=filename,
            document_type=doc_type,
            raw_text=raw_text,
            extracted_fields=fields,
        )

    def _extract_fields(self, doc_type: DocumentType, text: str) -> dict[str, str | None]:
        """Apply the field patterns defined in :data:`~app.document_schema.DOCUMENT_SCHEMA`
        for *doc_type* against *text* and return the extracted values.

        After generic regex extraction, a type-specific post-processor is applied
        when needed (currently only ``PROOF_OF_ADDRESS`` requires one).

        Args:
            doc_type: Detected document type.
            text: Raw OCR text to search.

        Returns:
            Dictionary mapping field keys to extracted string values (or ``None``
            when a pattern did not match).
        """
        spec = DOCUMENT_SCHEMA.get(doc_type.value)
        if spec is None:
            return {}

        fields: dict[str, str | None] = {}
        for field_spec in spec.fields:
            compiled = re.compile(field_spec.pattern, field_spec.flags)
            match = compiled.search(text)
            if match:
                raw = match.group(field_spec.group)
                fields[field_spec.key] = raw.strip() if raw else None
            else:
                fields[field_spec.key] = None

        if doc_type == DocumentType.PROOF_OF_ADDRESS:
            fields = self._combine_address(fields)

        return fields

    @staticmethod
    def _combine_address(fields: dict[str, str | None]) -> dict[str, str | None]:
        """Merge the street address and CEP internal field into a single value.

        The ``cep`` key is consumed here and is not present in the returned dict.

        Args:
            fields: Raw extraction result containing ``address`` and ``cep`` keys.

        Returns:
            Updated dict with a combined ``address`` value and no ``cep`` key.
        """
        address = fields.get("address")
        cep = fields.pop("cep", None)
        if address and cep and cep not in address:
            fields["address"] = f"{address}, CEP {cep}"
        elif not address and cep:
            fields["address"] = f"CEP {cep}"
        return fields
