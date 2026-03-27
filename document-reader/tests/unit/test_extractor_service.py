"""Unit tests for the ExtractorService — document type detection and field extraction."""

import pytest

from app.models.document import DocumentType
from app.services.extractor_service import ExtractorService


@pytest.fixture
def svc() -> ExtractorService:
    """Return a fresh ExtractorService instance."""
    return ExtractorService()


def test_detect_rg_document(svc: ExtractorService) -> None:
    """'REGISTRO GERAL' keyword is classified as RG document type."""
    assert svc.detect_document_type("REGISTRO GERAL DO ESTADO") == DocumentType.RG


def test_detect_birth_certificate(svc: ExtractorService) -> None:
    """'CERTIDÃO DE NASCIMENTO' keyword is classified as BIRTH_CERTIFICATE."""
    assert svc.detect_document_type("CERTIDÃO DE NASCIMENTO") == DocumentType.BIRTH_CERTIFICATE


def test_detect_marriage_certificate(svc: ExtractorService) -> None:
    """'CERTIDÃO DE CASAMENTO' keyword is classified as MARRIAGE_CERTIFICATE."""
    assert svc.detect_document_type("CERTIDÃO DE CASAMENTO") == DocumentType.MARRIAGE_CERTIFICATE


def test_detect_work_card(svc: ExtractorService) -> None:
    """'CARTEIRA DE TRABALHO' keyword is classified as WORK_CARD."""
    text = "CARTEIRA DE TRABALHO E PREVIDÊNCIA SOCIAL"
    assert svc.detect_document_type(text) == DocumentType.WORK_CARD


def test_detect_pis(svc: ExtractorService) -> None:
    """'PIS/PASEP' keyword is classified as PIS document type."""
    assert svc.detect_document_type("PIS/PASEP NÚMERO") == DocumentType.PIS


def test_detect_proof_of_address(svc: ExtractorService) -> None:
    """'COMPROVANTE DE RESIDÊNCIA' keyword is classified as PROOF_OF_ADDRESS."""
    assert svc.detect_document_type("COMPROVANTE DE RESIDÊNCIA") == DocumentType.PROOF_OF_ADDRESS


def test_detect_proof_of_education(svc: ExtractorService) -> None:
    """'DIPLOMA' keyword is classified as PROOF_OF_EDUCATION."""
    assert svc.detect_document_type("DIPLOMA DE GRADUAÇÃO") == DocumentType.PROOF_OF_EDUCATION


def test_detect_unknown(svc: ExtractorService) -> None:
    """Text with no known keywords is classified as UNKNOWN."""
    assert svc.detect_document_type("some random text without keywords") == DocumentType.UNKNOWN


def test_extract_rg_fields(svc: ExtractorService) -> None:
    """RG text yields correct document type, rg_number, and name fields."""
    text = "REGISTRO GERAL\nNome: João Silva\nRG: 12.345.678-9"
    doc = svc.extract("rg.jpg", text)
    assert doc.document_type == DocumentType.RG
    assert doc.extracted_fields.get("rg_number") == "12.345.678-9"
    assert doc.extracted_fields.get("name") == "João Silva"


def test_extract_pis_fields(svc: ExtractorService) -> None:
    """PIS text yields a non-None pis_number that starts with the expected digits."""
    text = "PIS\nNúmero PIS: 123.45678.90-1"
    doc = svc.extract("pis.jpg", text)
    assert doc.document_type == DocumentType.PIS
    assert doc.extracted_fields.get("pis_number") is not None
    assert "123" in (doc.extracted_fields.get("pis_number") or "")


def test_extract_proof_of_education_fields(svc: ExtractorService) -> None:
    """Education certificate text yields institution name and completion year."""
    text = "DIPLOMA DE GRADUAÇÃO\nUniversidade Federal do Brasil\nAno de Conclusão: 2020"
    doc = svc.extract("diploma.jpg", text)
    assert doc.document_type == DocumentType.PROOF_OF_EDUCATION
    assert doc.extracted_fields.get("institution_name") is not None
    assert "Universidade" in (doc.extracted_fields.get("institution_name") or "")
    assert doc.extracted_fields.get("year_of_completion") == "2020"


# ---------------------------------------------------------------------------
# forced_type tests
# ---------------------------------------------------------------------------


def test_extract_with_forced_type_skips_detection(svc: ExtractorService) -> None:
    """Passing forced_type bypasses keyword detection and uses the supplied type."""
    # Text has no BIRTH_CERTIFICATE keywords — detection would classify as UNKNOWN.
    text = "Some random text without any recognisable document keywords"
    doc = svc.extract("file.jpg", text, forced_type=DocumentType.BIRTH_CERTIFICATE)
    assert doc.document_type == DocumentType.BIRTH_CERTIFICATE


def test_extract_with_forced_type_runs_field_extraction(svc: ExtractorService) -> None:
    """Fields are extracted for the forced type even when keywords are absent."""
    # Text has no RG keywords but contains RG-style field patterns.
    text = "Nome: Maria Oliveira\nRG: 98.765.432-1"
    doc = svc.extract("file.jpg", text, forced_type=DocumentType.RG)
    assert doc.document_type == DocumentType.RG
    assert doc.extracted_fields.get("rg_number") == "98.765.432-1"
    assert doc.extracted_fields.get("name") == "Maria Oliveira"


def test_extract_with_forced_type_overrides_keyword_detection(svc: ExtractorService) -> None:
    """forced_type wins even when the OCR text contains different document keywords."""
    # Text would normally be classified as WORK_CARD, but forced_type says PIS.
    text = "CARTEIRA DE TRABALHO E PREVIDÊNCIA SOCIAL"
    doc = svc.extract("file.jpg", text, forced_type=DocumentType.PIS)
    assert doc.document_type == DocumentType.PIS


def test_extract_forced_type_none_falls_back_to_detection(svc: ExtractorService) -> None:
    """forced_type=None uses the regular keyword-based detection path."""
    text = "REGISTRO GERAL\nNome: Test\nRG: 11.111.111-1"
    doc = svc.extract("file.jpg", text, forced_type=None)
    assert doc.document_type == DocumentType.RG


def test_extract_forced_type_unknown_returns_empty_fields(svc: ExtractorService) -> None:
    """forced_type=UNKNOWN returns an empty extracted_fields dict."""
    text = "REGISTRO GERAL\nNome: Test\nRG: 11.111.111-1"
    doc = svc.extract("file.jpg", text, forced_type=DocumentType.UNKNOWN)
    assert doc.document_type == DocumentType.UNKNOWN
    assert doc.extracted_fields == {}

