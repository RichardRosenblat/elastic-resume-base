"""Tests for the document schema — the single table of truth."""

import re

import pytest

from app.document_schema import (
    ALLOWED_FILE_EXTENSIONS,
    DETECTION_PRIORITY,
    DOCUMENT_SCHEMA,
    IMAGE_EXTENSIONS,
    DocumentSpec,
)
from app.models.document import DocumentType

# ---------------------------------------------------------------------------
# Schema completeness
# ---------------------------------------------------------------------------


def test_document_schema_keys_match_enum() -> None:
    """Every DOCUMENT_SCHEMA key must correspond to a valid DocumentType value."""
    valid_values = {dt.value for dt in DocumentType if dt != DocumentType.UNKNOWN}
    assert set(DOCUMENT_SCHEMA.keys()) == valid_values


def test_detection_priority_matches_schema_keys() -> None:
    """DETECTION_PRIORITY must contain exactly the same keys as DOCUMENT_SCHEMA."""
    assert set(DETECTION_PRIORITY) == set(DOCUMENT_SCHEMA.keys())
    assert len(DETECTION_PRIORITY) == len(DOCUMENT_SCHEMA)


def test_detection_priority_has_no_duplicates() -> None:
    """DETECTION_PRIORITY must not contain repeated document type keys."""
    assert len(DETECTION_PRIORITY) == len(set(DETECTION_PRIORITY))


# ---------------------------------------------------------------------------
# FieldSpec validity
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("doc_type_key, doc_spec", DOCUMENT_SCHEMA.items())
def test_all_fields_have_valid_patterns(doc_type_key: str, doc_spec: DocumentSpec) -> None:
    """Every FieldSpec pattern must compile without errors."""
    for field in doc_spec.fields:
        try:
            re.compile(field.pattern, field.flags)
        except re.error as exc:
            pytest.fail(f"Invalid regex in {doc_type_key}.{field.key}: {field.pattern!r} — {exc}")


@pytest.mark.parametrize("doc_type_key, doc_spec", DOCUMENT_SCHEMA.items())
def test_all_field_keys_are_non_empty(doc_type_key: str, doc_spec: DocumentSpec) -> None:
    """Every FieldSpec must have a non-empty key string."""
    for field in doc_spec.fields:
        assert field.key, f"{doc_type_key}: FieldSpec has empty key"


@pytest.mark.parametrize("doc_type_key, doc_spec", DOCUMENT_SCHEMA.items())
def test_each_document_type_has_visible_field(doc_type_key: str, doc_spec: DocumentSpec) -> None:
    """Each document type must expose at least one Excel column (non-None label)."""
    visible = [f for f in doc_spec.fields if f.label is not None]
    assert visible, f"{doc_type_key} has no fields with an Excel label"


@pytest.mark.parametrize("doc_type_key, doc_spec", DOCUMENT_SCHEMA.items())
def test_all_keywords_are_uppercase(doc_type_key: str, doc_spec: DocumentSpec) -> None:
    """Detection keywords must be uppercase (the detector uppercases text before comparing)."""
    for kw in doc_spec.keywords:
        assert kw == kw.upper(), (
            f"{doc_type_key}: keyword {kw!r} is not uppercase — "
            "detection compares against uppercased OCR text"
        )


@pytest.mark.parametrize("doc_type_key, doc_spec", DOCUMENT_SCHEMA.items())
def test_each_type_has_at_least_one_keyword(doc_type_key: str, doc_spec: DocumentSpec) -> None:
    """Every document type must declare at least one detection keyword."""
    assert doc_spec.keywords, f"{doc_type_key}: no detection keywords defined"


# ---------------------------------------------------------------------------
# DocumentSpec immutability
# ---------------------------------------------------------------------------


def test_document_spec_is_frozen() -> None:
    """DocumentSpec instances must be immutable (frozen dataclass)."""
    spec = next(iter(DOCUMENT_SCHEMA.values()))
    with pytest.raises((AttributeError, TypeError)):
        spec.keywords = ("NEW_KW",)  # type: ignore[misc]


def test_field_spec_is_frozen() -> None:
    """FieldSpec instances must be immutable (frozen dataclass)."""
    field = next(iter(DOCUMENT_SCHEMA.values())).fields[0]
    with pytest.raises((AttributeError, TypeError)):
        field.key = "changed"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# File extension sets
# ---------------------------------------------------------------------------


def test_image_extensions_subset_of_allowed() -> None:
    """IMAGE_EXTENSIONS must be a subset of ALLOWED_FILE_EXTENSIONS."""
    assert IMAGE_EXTENSIONS.issubset(ALLOWED_FILE_EXTENSIONS)


def test_allowed_extensions_include_pdf_and_docx() -> None:
    """PDF and DOCX must be in the allowed extension set."""
    assert ".pdf" in ALLOWED_FILE_EXTENSIONS
    assert ".docx" in ALLOWED_FILE_EXTENSIONS


def test_allowed_extensions_do_not_include_zip() -> None:
    """ZIP is not a directly processable OCR format and must not be in the set."""
    assert ".zip" not in ALLOWED_FILE_EXTENSIONS


def test_all_extensions_are_lowercase_with_dot() -> None:
    """All extensions must start with '.' and be lowercase."""
    for ext in ALLOWED_FILE_EXTENSIONS | IMAGE_EXTENSIONS:
        assert ext.startswith("."), f"{ext!r} does not start with '.'"
        assert ext == ext.lower(), f"{ext!r} is not lowercase"


# ---------------------------------------------------------------------------
# Specific field presence checks (guard against accidental removal)
# ---------------------------------------------------------------------------


def test_rg_schema_has_rg_number_and_name_fields() -> None:
    """RG document spec must define both 'rg_number' and 'name' field keys."""
    keys = {f.key for f in DOCUMENT_SCHEMA["RG"].fields}
    assert "rg_number" in keys
    assert "name" in keys


def test_birth_certificate_has_date_of_birth_field() -> None:
    """Birth certificate document spec must define a 'date_of_birth' field key."""
    keys = {f.key for f in DOCUMENT_SCHEMA["BIRTH_CERTIFICATE"].fields}
    assert "date_of_birth" in keys


def test_marriage_certificate_has_spouse_name_field() -> None:
    """Marriage certificate document spec must define a 'spouse_name' field key."""
    keys = {f.key for f in DOCUMENT_SCHEMA["MARRIAGE_CERTIFICATE"].fields}
    assert "spouse_name" in keys


def test_proof_of_address_has_internal_cep_field() -> None:
    """The internal CEP field must have label=None (not emitted to Excel)."""
    cep_fields = [f for f in DOCUMENT_SCHEMA["PROOF_OF_ADDRESS"].fields if f.key == "cep"]
    assert cep_fields, "PROOF_OF_ADDRESS must define an internal 'cep' field"
    assert cep_fields[0].label is None, "'cep' field must be internal-only (label=None)"


def test_unique_field_spec_labels_across_schema() -> None:
    """Fields sharing a label across types must be intentional.

    Currently two labels are shared:
    * ``"Nome"`` — appears in RG, BIRTH_CERTIFICATE, MARRIAGE_CERTIFICATE.
    * ``"Data"`` — appears in BIRTH_CERTIFICATE (date_of_birth) and
      MARRIAGE_CERTIFICATE (date_of_marriage).

    If a new unintended duplicate is introduced, this test will catch it.
    """
    label_counts: dict[str, int] = {}
    for doc_spec in DOCUMENT_SCHEMA.values():
        for field in doc_spec.fields:
            if field.label is not None:
                label_counts[field.label] = label_counts.get(field.label, 0) + 1
    # "Nome" and "Data" are intentionally shared across multiple document types.
    multi_label = {label for label, count in label_counts.items() if count > 1}
    intentional = {"Data", "Nome"}
    unexpected = multi_label - intentional
    assert not unexpected, (
        f"Unexpected shared column labels: {unexpected}. "
        "If intentional, add them to the `intentional` set in this test."
    )
