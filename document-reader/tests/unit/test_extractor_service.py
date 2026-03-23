import pytest

from app.models.document import DocumentType
from app.services.extractor_service import ExtractorService


@pytest.fixture
def svc() -> ExtractorService:
    return ExtractorService()


def test_detect_rg_document(svc: ExtractorService) -> None:
    assert svc.detect_document_type("REGISTRO GERAL DO ESTADO") == DocumentType.RG


def test_detect_birth_certificate(svc: ExtractorService) -> None:
    assert svc.detect_document_type("CERTIDÃO DE NASCIMENTO") == DocumentType.BIRTH_CERTIFICATE


def test_detect_marriage_certificate(svc: ExtractorService) -> None:
    assert svc.detect_document_type("CERTIDÃO DE CASAMENTO") == DocumentType.MARRIAGE_CERTIFICATE


def test_detect_work_card(svc: ExtractorService) -> None:
    text = "CARTEIRA DE TRABALHO E PREVIDÊNCIA SOCIAL"
    assert svc.detect_document_type(text) == DocumentType.WORK_CARD


def test_detect_pis(svc: ExtractorService) -> None:
    assert svc.detect_document_type("PIS/PASEP NÚMERO") == DocumentType.PIS


def test_detect_proof_of_address(svc: ExtractorService) -> None:
    assert svc.detect_document_type("COMPROVANTE DE RESIDÊNCIA") == DocumentType.PROOF_OF_ADDRESS


def test_detect_proof_of_education(svc: ExtractorService) -> None:
    assert svc.detect_document_type("DIPLOMA DE GRADUAÇÃO") == DocumentType.PROOF_OF_EDUCATION


def test_detect_unknown(svc: ExtractorService) -> None:
    assert svc.detect_document_type("some random text without keywords") == DocumentType.UNKNOWN


def test_extract_rg_fields(svc: ExtractorService) -> None:
    text = "REGISTRO GERAL\nNome: João Silva\nRG: 12.345.678-9"
    doc = svc.extract("rg.jpg", text)
    assert doc.document_type == DocumentType.RG
    assert doc.extracted_fields.get("rg_number") == "12.345.678-9"
    assert doc.extracted_fields.get("name") == "João Silva"


def test_extract_pis_fields(svc: ExtractorService) -> None:
    text = "PIS\nNúmero PIS: 123.45678.90-1"
    doc = svc.extract("pis.jpg", text)
    assert doc.document_type == DocumentType.PIS
    assert doc.extracted_fields.get("pis_number") is not None
    assert "123" in (doc.extracted_fields.get("pis_number") or "")


def test_extract_proof_of_education_fields(svc: ExtractorService) -> None:
    text = "DIPLOMA DE GRADUAÇÃO\nUniversidade Federal do Brasil\nAno de Conclusão: 2020"
    doc = svc.extract("diploma.jpg", text)
    assert doc.document_type == DocumentType.PROOF_OF_EDUCATION
    assert doc.extracted_fields.get("institution_name") is not None
    assert "Universidade" in (doc.extracted_fields.get("institution_name") or "")
    assert doc.extracted_fields.get("year_of_completion") == "2020"
