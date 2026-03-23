import re

from app.models.document import DocumentType, ExtractedDocument

_RG_KEYWORDS = {"REGISTRO GERAL", "IDENTIDADE", "CARTEIRA DE IDENTIDADE", "SECRETARIA DE SEGURANÇA"}
_BIRTH_KEYWORDS = {"CERTIDÃO DE NASCIMENTO", "NASCIMENTO"}
_MARRIAGE_KEYWORDS = {"CERTIDÃO DE CASAMENTO", "CASAMENTO"}
_WORK_CARD_KEYWORDS = {"CARTEIRA DE TRABALHO", "CTPS", "MINISTÉRIO DO TRABALHO"}
_PIS_KEYWORDS = {"PIS", "PASEP", "NIS", "PROGRAMA DE INTEGRAÇÃO SOCIAL"}
_ADDRESS_KEYWORDS = {
    "COMPROVANTE DE RESIDÊNCIA",
    "COMPROVANTE DE ENDEREÇO",
    "CONTA DE ÁGUA",
    "CONTA DE LUZ",
    "CONTA DE ENERGIA",
    "FATURA",
}
_EDUCATION_KEYWORDS = {
    "DIPLOMA",
    "CERTIFICADO DE CONCLUSÃO",
    "HISTÓRICO ESCOLAR",
    "UNIVERSIDADE",
    "FACULDADE",
    "INSTITUIÇÃO DE ENSINO",
}

_RE_RG = re.compile(r"\d{1,2}\.?\d{3}\.?\d{3}-?[\dXx]")
_RE_NAME = re.compile(r"(?:NOME|Nome)\s*[:\-]?\s*([A-ZÀ-Ú][A-Za-zÀ-ú ]{2,})", re.IGNORECASE)
_RE_DATE = re.compile(r"\d{2}[/.\-]\d{2}[/.\-]\d{4}|\d{2} de \w+ de \d{4}", re.IGNORECASE)
_RE_PIS = re.compile(r"\d{3}\.?\d{5}\.?\d{2}-?\d")
_RE_CEP = re.compile(r"\d{5}-?\d{3}")
_RE_YEAR = re.compile(r"\b(19|20)\d{2}\b")
_RE_INSTITUTION = re.compile(
    r"(?:UNIVERSIDADE|FACULDADE|INSTITUTO|CENTRO UNIVERSITÁRIO|ESCOLA)\s+[A-ZÀ-Ú][A-Za-zÀ-ú ]+",
    re.IGNORECASE,
)
_RE_SPOUSE = re.compile(
    r"(?:CÔNJUGE|ESPOSO|ESPOSA|CONTRATANTE|NOIVO|NOIVA)\s*[:\-]?\s*([A-ZÀ-Ú][A-Za-zÀ-ú ]{2,})",
    re.IGNORECASE,
)
_RE_WORK_CARD_NUMBER = re.compile(
    r"(?:N[°º]?\.?\s*(?:CTPS)?|CTPS\s*N[°º]?\.?)\s*(\d[\d.\-/]+)", re.IGNORECASE
)
_RE_ADDRESS = re.compile(
    r"(?:RUA|AV(?:ENIDA)?|TRAVESSA|ALAMEDA|ESTRADA|RODOVIA)[.,]?\s+[A-Za-zÀ-ú0-9\s,.\-º°]+(?:CEP\s*:?\s*\d{5}-?\d{3})?",
    re.IGNORECASE,
)


class ExtractorService:
    """Service for detecting document type and extracting structured fields."""

    def detect_document_type(self, text: str) -> DocumentType:
        """Detect the Brazilian document type from OCR text using keyword matching.

        Args:
            text: Raw OCR text from the document.

        Returns:
            The detected DocumentType.
        """
        upper = text.upper()

        if any(kw in upper for kw in _RG_KEYWORDS):
            return DocumentType.RG
        if any(kw in upper for kw in _MARRIAGE_KEYWORDS):
            return DocumentType.MARRIAGE_CERTIFICATE
        if any(kw in upper for kw in _BIRTH_KEYWORDS):
            return DocumentType.BIRTH_CERTIFICATE
        if any(kw in upper for kw in _WORK_CARD_KEYWORDS):
            return DocumentType.WORK_CARD
        if any(kw in upper for kw in _PIS_KEYWORDS):
            return DocumentType.PIS
        if any(kw in upper for kw in _ADDRESS_KEYWORDS):
            return DocumentType.PROOF_OF_ADDRESS
        if any(kw in upper for kw in _EDUCATION_KEYWORDS):
            return DocumentType.PROOF_OF_EDUCATION
        return DocumentType.UNKNOWN

    def extract(self, filename: str, raw_text: str) -> ExtractedDocument:
        """Detect document type and extract structured fields from OCR text.

        Args:
            filename: Original filename of the uploaded document.
            raw_text: Raw OCR text.

        Returns:
            ExtractedDocument with detected type and extracted fields.
        """
        doc_type = self.detect_document_type(raw_text)

        extractors = {
            DocumentType.RG: self._extract_rg_fields,
            DocumentType.BIRTH_CERTIFICATE: self._extract_birth_certificate_fields,
            DocumentType.MARRIAGE_CERTIFICATE: self._extract_marriage_certificate_fields,
            DocumentType.WORK_CARD: self._extract_work_card_fields,
            DocumentType.PIS: self._extract_pis_fields,
            DocumentType.PROOF_OF_ADDRESS: self._extract_proof_of_address_fields,
            DocumentType.PROOF_OF_EDUCATION: self._extract_proof_of_education_fields,
        }

        fields: dict[str, str | None] = {}
        if doc_type in extractors:
            fields = extractors[doc_type](raw_text)

        return ExtractedDocument(
            filename=filename,
            document_type=doc_type,
            raw_text=raw_text,
            extracted_fields=fields,
        )

    def _extract_rg_fields(self, text: str) -> dict[str, str | None]:
        """Extract ID number and name from RG text.

        Args:
            text: Raw OCR text from an RG document.

        Returns:
            Dictionary with 'rg_number' and 'name' keys.
        """
        rg_match = _RE_RG.search(text)
        name_match = _RE_NAME.search(text)
        return {
            "rg_number": rg_match.group(0) if rg_match else None,
            "name": name_match.group(1).strip() if name_match else None,
        }

    def _extract_birth_certificate_fields(self, text: str) -> dict[str, str | None]:
        """Extract name and date of birth from birth certificate text.

        Args:
            text: Raw OCR text from a birth certificate.

        Returns:
            Dictionary with 'name' and 'date_of_birth' keys.
        """
        name_match = _RE_NAME.search(text)
        date_match = _RE_DATE.search(text)
        return {
            "name": name_match.group(1).strip() if name_match else None,
            "date_of_birth": date_match.group(0) if date_match else None,
        }

    def _extract_marriage_certificate_fields(self, text: str) -> dict[str, str | None]:
        """Extract name, date of marriage, and spouse name from marriage certificate text.

        Args:
            text: Raw OCR text from a marriage certificate.

        Returns:
            Dictionary with 'name', 'date_of_marriage', and 'spouse_name' keys.
        """
        name_match = _RE_NAME.search(text)
        date_match = _RE_DATE.search(text)
        spouse_match = _RE_SPOUSE.search(text)
        return {
            "name": name_match.group(1).strip() if name_match else None,
            "date_of_marriage": date_match.group(0) if date_match else None,
            "spouse_name": spouse_match.group(1).strip() if spouse_match else None,
        }

    def _extract_work_card_fields(self, text: str) -> dict[str, str | None]:
        """Extract issue date and work card number from CTPS text.

        Args:
            text: Raw OCR text from a work card (CTPS).

        Returns:
            Dictionary with 'issue_date' and 'work_card_number' keys.
        """
        date_match = _RE_DATE.search(text)
        number_match = _RE_WORK_CARD_NUMBER.search(text)
        return {
            "issue_date": date_match.group(0) if date_match else None,
            "work_card_number": number_match.group(1).strip() if number_match else None,
        }

    def _extract_pis_fields(self, text: str) -> dict[str, str | None]:
        """Extract PIS/NIS number from PIS document text.

        Args:
            text: Raw OCR text from a PIS document.

        Returns:
            Dictionary with 'pis_number' key.
        """
        match = _RE_PIS.search(text)
        return {"pis_number": match.group(0) if match else None}

    def _extract_proof_of_address_fields(self, text: str) -> dict[str, str | None]:
        """Extract full address from proof of address text.

        Args:
            text: Raw OCR text from a proof of address document.

        Returns:
            Dictionary with 'address' key.
        """
        addr_match = _RE_ADDRESS.search(text)
        cep_match = _RE_CEP.search(text)

        address = None
        if addr_match:
            address = addr_match.group(0).strip()
            if cep_match and cep_match.group(0) not in address:
                address = f"{address}, CEP {cep_match.group(0)}"
        elif cep_match:
            address = f"CEP {cep_match.group(0)}"

        return {"address": address}

    def _extract_proof_of_education_fields(self, text: str) -> dict[str, str | None]:
        """Extract institution name and year of completion from proof of education text.

        Args:
            text: Raw OCR text from a proof of education document.

        Returns:
            Dictionary with 'institution_name' and 'year_of_completion' keys.
        """
        inst_match = _RE_INSTITUTION.search(text)
        year_match = _RE_YEAR.search(text)
        return {
            "institution_name": inst_match.group(0).strip() if inst_match else None,
            "year_of_completion": year_match.group(0) if year_match else None,
        }
